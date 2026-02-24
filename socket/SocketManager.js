const { GameEngine, Phase } = require('../engine/GameEngine');

class SocketManager {
    constructor(io) {
        this.io = io;
        this.engine = new GameEngine();
        this.rooms = new Map();
        this.socketMap = new Map(); // socketId -> { roomCode, playerId }
        this.setupSocketListeners();
    }

    setupSocketListeners() {
        this.io.on('connection', (socket) => {
            console.log('新玩家连接:', socket.id);

            // 创建房间
            socket.on('createRoom', (data) => {
                this.handleCreateRoom(socket, data);
            });

            // 加入房间
            socket.on('joinRoom', (data) => {
                this.handleJoinRoom(socket, data);
            });

            // 开始游戏
            socket.on('startGame', (data) => {
                this.handleStartGame(socket, data);
            });

            // 执行行动
            socket.on('executeAction', (data) => {
                this.handleExecuteAction(socket, data);
            });

            // 挑战
            socket.on('challenge', (data) => {
                this.handleChallenge(socket, data);
            });

            // 反制
            socket.on('counter', (data) => {
                this.handleCounter(socket, data);
            });

            // 弃牌
            socket.on('discard', (data) => {
                this.handleDiscard(socket, data);
            });

            // 聊天
            socket.on('chat', (data) => {
                this.handleChat(socket, data);
            });

            // 断线重连
            socket.on('reconnect', (data) => {
                this.handleReconnect(socket, data);
            });

            // 断开连接
            socket.on('disconnect', () => {
                this.handleDisconnect(socket);
            });
        });
    }

    // 创建房间
    handleCreateRoom(socket, data) {
        const { playerName } = data;
        const roomCode = this.generateRoomCode();
        const playerId = this.generatePlayerId();

        const room = {
            code: roomCode,
            hostId: playerId,
            players: new Map(),
            gameState: {
                status: 'waiting',
                turnIndex: 0,
                currentPlayer: null,
                deck: [],
                discardPile: [],
                lastAction: null,
                phase: { type: Phase.TURN_START, data: {} },
                log: []
            },
            lock: false,
            createdAt: Date.now()
        };

        const player = {
            id: playerId,
            name: playerName,
            coins: 2,
            cards: [],
            isAlive: true,
            socketId: socket.id,
            connected: true,
            disconnectTime: null
        };

        room.players.set(playerId, player);
        this.rooms.set(roomCode, room);
        this.socketMap.set(socket.id, { roomCode, playerId });

        socket.join(roomCode);

        socket.emit('createRoomSuccess', {
            roomCode,
            playerId,
            playerName,
            gameState: this.engine.getFilteredGameState(room, playerId)
        });

        this.broadcastRoomUpdate(room);
    }

    // 加入房间
    handleJoinRoom(socket, data) {
        const { roomCode, playerName, playerId } = data;
        const room = this.rooms.get(roomCode);

        if (!room) {
            socket.emit('joinRoomError', { message: '房间不存在' });
            return;
        }

        if (room.gameState.status !== 'waiting') {
            socket.emit('joinRoomError', { message: '游戏已开始' });
            return;
        }

        if (room.players.size >= 6) {
            socket.emit('joinRoomError', { message: '房间已满' });
            return;
        }

        let player;
        if (playerId && room.players.has(playerId)) {
            // 断线重连
            player = room.players.get(playerId);
            player.socketId = socket.id;
            player.connected = true;
            player.disconnectTime = null;
        } else {
            // 新玩家
            player = {
                id: this.generatePlayerId(),
                name: playerName,
                coins: 2,
                cards: [],
                isAlive: true,
                socketId: socket.id,
                connected: true,
                disconnectTime: null
            };
            room.players.set(player.id, player);
        }

        this.socketMap.set(socket.id, { roomCode, playerId: player.id });
        socket.join(roomCode);

        socket.emit('joinRoomSuccess', {
            roomCode,
            playerId: player.id,
            playerName: player.name,
            gameState: this.engine.getFilteredGameState(room, player.id)
        });

        this.broadcastRoomUpdate(room);
    }

    // 开始游戏
    handleStartGame(socket, data) {
        const { roomCode, playerId } = data;
        const room = this.rooms.get(roomCode);

        if (!room) return;

        const player = room.players.get(playerId);
        if (!player || player.id !== room.hostId) {
            socket.emit('error', { message: '只有房主可以开始游戏' });
            return;
        }

        if (room.players.size < 2) {
            socket.emit('error', { message: '至少需要2名玩家' });
            return;
        }

        room.gameState.status = 'playing';
        this.engine.initializeGame(room);

        this.broadcastGameState(room);
    }

    // 执行行动
    handleExecuteAction(socket, data) {
        const { roomCode, playerId, actionType, targetPlayerId } = data;
        const room = this.rooms.get(roomCode);

        if (!room) return;

        const phase = room.gameState.phase;
        if (phase.type !== Phase.TURN_START) {
            socket.emit('error', { message: '当前阶段无法执行行动' });
            return;
        }

        const currentPlayer = room.gameState.currentPlayer;
        if (currentPlayer !== playerId) {
            socket.emit('error', { message: '不是你的回合' });
            return;
        }

        this.engine.withLock(room, () => {
            const actionResult = this.engine.executeAction(room, playerId, actionType, targetPlayerId);
            
            if (actionResult) {
                room.gameState.lastAction = actionResult;
                room.gameState.log.push(...actionResult.log);

                // 根据行动结果设置相应的阶段
                if (room.gameState.challengeData) {
                    // 进入挑战阶段，启动计时器
                    this.engine.startTimer(room, 20, () => {
                        this.resolveChallengeTimeout(room);
                    });
                } else if (room.gameState.counterData) {
                    // 进入反制阶段，启动计时器
                    this.engine.startTimer(room, 15, () => {
                        this.resolveCounterTimeout(room);
                    });
                } else {
                    // 直接进入下一回合
                    this.engine.withLock(room, () => {
                        this.engine.nextTurn(room);
                    });
                }

                this.broadcastGameState(room);
            } else {
                socket.emit('error', { message: '无法执行该行动' });
            }
        });
    }

    // 处理挑战
    handleChallenge(socket, data) {
        const { roomCode, playerId } = data;
        const room = this.rooms.get(roomCode);

        if (!room) return;

        const phase = room.gameState.phase;
        if (phase.type !== Phase.CHALLENGE_WINDOW) {
            socket.emit('error', { message: '当前阶段无法挑战' });
            return;
        }

        this.engine.withLock(room, () => {
            const challengeResult = this.engine.handleChallenge(room, playerId);
            
            if (challengeResult) {
                room.gameState.log.push(...challengeResult.log);
                this.broadcastGameState(room);
            }
        });
    }

    // 处理反制
    handleCounter(socket, data) {
        const { roomCode, playerId, block } = data;
        const room = this.rooms.get(roomCode);

        if (!room) return;

        const phase = room.gameState.phase;
        if (phase.type !== Phase.COUNTER_WINDOW) {
            socket.emit('error', { message: '当前阶段无法反制' });
            return;
        }

        const counterData = room.gameState.counterData;
        if (!counterData || !counterData.potentialBlockers.includes(playerId)) {
            socket.emit('error', { message: '你无法反制这个行动' });
            return;
        }

        this.engine.withLock(room, () => {
            const counterResult = this.engine.handleCounter(room, playerId, block);
            
            if (counterResult) {
                room.gameState.log.push(...counterResult.log);
                this.broadcastGameState(room);
            }
        });
    }

    // 处理弃牌
    handleDiscard(socket, data) {
        const { roomCode, playerId, cardIndex } = data;
        const room = this.rooms.get(roomCode);

        if (!room) return;

        const phase = room.gameState.phase;
        if (phase.type !== Phase.DISCARD) {
            socket.emit('error', { message: '当前阶段无法弃牌' });
            return;
        }

        this.engine.withLock(room, () => {
            const result = this.engine.handleDiscard(room, playerId, cardIndex);
            
            if (result) {
                room.gameState.log.push(`${room.players.get(playerId).name} 弃掉了一张牌`);
                this.broadcastGameState(room);
            } else {
                socket.emit('error', { message: '弃牌失败' });
            }
        });
    }

    // 处理聊天
    handleChat(socket, data) {
        const { roomCode, playerId, message } = data;
        const room = this.rooms.get(roomCode);

        if (!room) return;

        const player = room.players.get(playerId);
        if (!player) return;

        const chatMessage = {
            playerId,
            playerName: player.name,
            message,
            timestamp: Date.now()
        };

        room.gameState.log.push(`[聊天] ${player.name}: ${message}`);

        this.io.to(roomCode).emit('chatMessage', chatMessage);
    }

    // 处理断线重连
    handleReconnect(socket, data) {
        const { roomCode, playerId } = data;
        const room = this.rooms.get(roomCode);

        if (!room) {
            socket.emit('reconnectError', { message: '房间不存在' });
            return;
        }

        const player = room.players.get(playerId);
        if (!player) {
            socket.emit('reconnectError', { message: '玩家不存在' });
            return;
        }

        // 更新连接状态
        player.socketId = socket.id;
        player.connected = true;
        player.disconnectTime = null;

        this.socketMap.set(socket.id, { roomCode, playerId });
        socket.join(roomCode);

        socket.emit('reconnectSuccess', {
            gameState: this.engine.getFilteredGameState(room, playerId)
        });

        this.broadcastRoomUpdate(room);
    }

    // 处理断开连接
    handleDisconnect(socket) {
        const mapping = this.socketMap.get(socket.id);
        if (!mapping) return;

        const { roomCode, playerId } = mapping;
        const room = this.rooms.get(roomCode);

        if (!room) return;

        const player = room.players.get(playerId);
        if (player) {
            player.connected = false;
            player.disconnectTime = Date.now();
            player.socketId = null;

            console.log(`${player.name} 断开连接`);

            // 通知其他玩家
            this.io.to(roomCode).emit('playerDisconnected', {
                playerId,
                playerName: player.name
            });

            this.broadcastRoomUpdate(room);

            // 如果游戏正在进行，检查是否需要处理断线玩家
            if (room.gameState.status === 'playing') {
                this.checkDisconnectedPlayerInGame(room, playerId);
            }
        }

        this.socketMap.delete(socket.id);

        // 清理空房间
        setTimeout(() => {
            this.cleanupEmptyRoom(roomCode);
        }, 30000); // 30秒后检查
    }

    // 检查游戏中的断线玩家
    checkDisconnectedPlayerInGame(room, playerId) {
        const phase = room.gameState.phase;
        const currentPlayer = room.gameState.currentPlayer;

        // 如果断线的是当前行动玩家，自动跳过
        if (currentPlayer === playerId) {
            this.engine.withLock(room, () => {
                room.gameState.log.push(`${room.players.get(playerId).name} 已断线，自动跳过回合`);
                this.engine.nextTurn(room);
                this.broadcastGameState(room);
            });
        }
    }

    // 挑战超时处理
    resolveChallengeTimeout(room) {
        if (!room.gameState.challengeData) return;

        this.engine.withLock(room, () => {
            const challengeData = room.gameState.challengeData;
            room.gameState.challengeData = null;

            // 没有挑战者，行动成功
            const action = challengeData.action;
            const actor = room.players.get(action.playerId);

            room.gameState.log.push(`挑战时间结束，没有玩家挑战 ${actor.name}`);

            // 执行原行动
            switch (action.type) {
                case 'tax':
                    actor.coins += 3;
                    room.gameState.log.push(`${actor.name} 成功征收3枚金币`);
                    break;
                case 'steal':
                    const target = room.players.get(action.targetPlayerId);
                    if (target && target.coins > 0) {
                        const stealAmount = Math.min(target.coins, 2);
                        target.coins -= stealAmount;
                        actor.coins += stealAmount;
                        room.gameState.log.push(`${actor.name} 成功窃取 ${stealAmount} 枚金币`);
                    }
                    break;
                case 'exchange':
                    room.gameState.log.push(`${actor.name} 完成卡牌交换`);
                    break;
                case 'assassinate':
                    const assassinateTarget = room.players.get(action.targetPlayerId);
                    if (assassinateTarget && assassinateTarget.cards.length > 0) {
                        const randomIndex = Math.floor(Math.random() * assassinateTarget.cards.length);
                        this.engine.discardCard(room, assassinateTarget.id, randomIndex);
                        room.gameState.log.push(`${assassinateTarget.name} 被行刺，被迫弃牌`);
                    }
                    break;
            }

            this.engine.nextTurn(room);
            this.broadcastGameState(room);
        });
    }

    // 反制超时处理
    resolveCounterTimeout(room) {
        if (!room.gameState.counterData) return;

        this.engine.withLock(room, () => {
            const counterData = room.gameState.counterData;
            room.gameState.counterData = null;

            const action = counterData.action;
            const actor = room.players.get(action.playerId);

            room.gameState.log.push(`反制时间结束，执行原行动`);

            // 执行原行动
            if (action.type === 'foreign_aid') {
                actor.coins += 2;
                room.gameState.log.push(`${actor.name} 获得2枚金币`);
            } else if (action.type === 'assassinate') {
                const target = room.players.get(action.targetPlayerId);
                if (target && target.cards.length > 0) {
                    const randomIndex = Math.floor(Math.random() * target.cards.length);
                    this.engine.discardCard(room, target.id, randomIndex);
                    room.gameState.log.push(`${target.name} 被行刺，被迫弃牌`);
                }
            }

            this.engine.nextTurn(room);
            this.broadcastGameState(room);
        });
    }

    // 广播房间更新
    broadcastRoomUpdate(room) {
        const playersList = Array.from(room.players.values()).map(p => ({
            id: p.id,
            name: p.name,
            coins: p.coins,
            cardsCount: p.cards.length,
            isAlive: p.isAlive,
            isHost: p.id === room.hostId,
            connected: p.connected || false
        }));

        this.io.to(room.code).emit('roomUpdate', {
            roomCode: room.code,
            players: playersList,
            gameStatus: room.gameState.status
        });
    }

    // 广播游戏状态
    broadcastGameState(room) {
        room.players.forEach((player, playerId) => {
            const socket = this.io.sockets.sockets.get(player.socketId);
            if (socket) {
                socket.emit('gameStateUpdate', {
                    gameState: this.engine.getFilteredGameState(room, playerId),
                    roomCode: room.code
                });
            }
        });
    }

    // 清理空房间
    cleanupEmptyRoom(roomCode) {
        const room = this.rooms.get(roomCode);
        if (!room) return;

        const connectedPlayers = Array.from(room.players.values()).filter(p => p.connected);
        if (connectedPlayers.length === 0) {
            console.log(`清理空房间: ${roomCode}`);
            this.rooms.delete(roomCode);
        }
    }

    // 生成房间码
    generateRoomCode() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    // 生成玩家ID
    generatePlayerId() {
        return 'player_' + Math.random().toString(36).substring(2, 11);
    }
}

module.exports = SocketManager;