class RoomManager {
    constructor() {
        this.rooms = new Map();
        this.cleanupInterval = null;
        this.startCleanupInterval();
    }

    // 创建房间
    createRoom(roomCode, hostId) {
        const room = {
            code: roomCode,
            hostId,
            players: new Map(),
            gameState: {
                status: 'waiting',
                turnIndex: 0,
                currentPlayer: null,
                deck: [],
                discardPile: [],
                lastAction: null,
                phase: { type: 'TURN_START', data: {} },
                log: []
            },
            lock: false,
            createdAt: Date.now(),
            lastActivity: Date.now()
        };

        this.rooms.set(roomCode, room);
        return room;
    }

    // 获取房间
    getRoom(roomCode) {
        return this.rooms.get(roomCode);
    }

    // 删除房间
    deleteRoom(roomCode) {
        this.rooms.delete(roomCode);
    }

    // 添加玩家到房间
    addPlayer(room, player) {
        room.players.set(player.id, player);
        room.lastActivity = Date.now();
    }

    // 从房间移除玩家
    removePlayer(room, playerId) {
        room.players.delete(playerId);
        room.lastActivity = Date.now();
    }

    // 获取房间中的玩家
    getPlayer(room, playerId) {
        return room.players.get(playerId);
    }

    // 获取所有房间
    getAllRooms() {
        return Array.from(this.rooms.values());
    }

    // 获取房间数量
    getRoomCount() {
        return this.rooms.size;
    }

    // 获取活跃房间数量（有玩家的房间）
    getActiveRoomCount() {
        return Array.from(this.rooms.values()).filter(room => room.players.size > 0).length;
    }

    // 更新房间活动时间
    updateRoomActivity(roomCode) {
        const room = this.rooms.get(roomCode);
        if (room) {
            room.lastActivity = Date.now();
        }
    }

    // 检查房间是否存在
    roomExists(roomCode) {
        return this.rooms.has(roomCode);
    }

    // 检查房间是否已满
    isRoomFull(room) {
        return room.players.size >= 6;
    }

    // 检查房间是否可以开始游戏
    canStartGame(room) {
        return room.players.size >= 2 && room.gameState.status === 'waiting';
    }

    // 获取房间统计信息
    getRoomStats() {
        const rooms = Array.from(this.rooms.values());
        const totalRooms = rooms.length;
        const activeRooms = rooms.filter(room => room.players.size > 0).length;
        const waitingRooms = rooms.filter(room => room.gameState.status === 'waiting').length;
        const playingRooms = rooms.filter(room => room.gameState.status === 'playing').length;
        const totalPlayers = rooms.reduce((sum, room) => sum + room.players.size, 0);

        return {
            totalRooms,
            activeRooms,
            waitingRooms,
            playingRooms,
            totalPlayers
        };
    }

    // 启动定期清理任务
    startCleanupInterval() {
        this.cleanupInterval = setInterval(() => {
            this.cleanupInactiveRooms();
        }, 5 * 60 * 1000); // 每5分钟清理一次
    }

    // 停止定期清理任务
    stopCleanupInterval() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }

    // 清理不活跃的房间
    cleanupInactiveRooms() {
        const now = Date.now();
        const inactiveThreshold = 30 * 60 * 1000; // 30分钟不活跃
        const emptyThreshold = 5 * 60 * 1000; // 5分钟空房间

        const roomsToDelete = [];

        this.rooms.forEach((room, roomCode) => {
            const timeSinceActivity = now - room.lastActivity;
            const playerCount = room.players.size;

            // 删除长时间不活跃的房间
            if (timeSinceActivity > inactiveThreshold) {
                roomsToDelete.push(roomCode);
                console.log(`清理不活跃房间: ${roomCode} (${timeSinceActivity / 1000}秒无活动)`);
            }
            // 删除空房间
            else if (playerCount === 0 && timeSinceActivity > emptyThreshold) {
                roomsToDelete.push(roomCode);
                console.log(`清理空房间: ${roomCode}`);
            }
        });

        // 删除标记的房间
        roomsToDelete.forEach(roomCode => {
            this.rooms.delete(roomCode);
        });

        if (roomsToDelete.length > 0) {
            console.log(`总共清理 ${roomsToDelete.length} 个房间`);
        }
    }

    // 清理所有房间
    cleanupAllRooms() {
        this.rooms.clear();
        console.log('清理所有房间');
    }

    // 获取房间信息（用于调试）
    getRoomInfo(roomCode) {
        const room = this.rooms.get(roomCode);
        if (!room) return null;

        return {
            code: room.code,
            hostId: room.hostId,
            playerCount: room.players.size,
            gameStatus: room.gameState.status,
            createdAt: room.createdAt,
            lastActivity: room.lastActivity,
            players: Array.from(room.players.keys())
        };
    }

    // 导出房间数据（用于备份）
    exportRoomData(roomCode) {
        const room = this.rooms.get(roomCode);
        if (!room) return null;

        return {
            code: room.code,
            hostId: room.hostId,
            players: Array.from(room.players.entries()).map(([id, player]) => ({
                id,
                ...player
            })),
            gameState: { ...room.gameState },
            createdAt: room.createdAt,
            lastActivity: room.lastActivity
        };
    }

    // 导入房间数据（用于恢复）
    importRoomData(roomData) {
        try {
            const room = {
                code: roomData.code,
                hostId: roomData.hostId,
                players: new Map(roomData.players.map(p => [p.id, p])),
                gameState: { ...roomData.gameState },
                lock: false,
                createdAt: roomData.createdAt,
                lastActivity: Date.now()
            };

            this.rooms.set(room.code, room);
            return room;
        } catch (error) {
            console.error('导入房间数据失败:', error);
            return null;
        }
    }
}

module.exports = RoomManager;