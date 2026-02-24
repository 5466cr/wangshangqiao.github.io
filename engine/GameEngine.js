const Phase = {
    TURN_START: 'TURN_START',
    ACTION_DECLARED: 'ACTION_DECLARED',
    CHALLENGE_WINDOW: 'CHALLENGE_WINDOW',
    COUNTER_WINDOW: 'COUNTER_WINDOW',
    DISCARD: 'DISCARD',
    RESOLVE: 'RESOLVE',
    GAME_OVER: 'GAME_OVER'
};

class GameEngine {
    constructor() {
        this.timers = new Map();
    }

    // 最终安全版 setPhase（核心）
    setPhase(room, newPhase) {
        this.withLock(room, () => {
            // 1️⃣ 清理旧 timer
            this.clearTimer(room);
            
            // 2️⃣ 更新 phase
            room.gameState.phase = newPhase;
            
            // 3️⃣ 检查断线玩家
            this.checkDisconnectedPlayers(room);
            
            // 4️⃣ 推进状态机（防止递归栈爆）
            setImmediate(() => {
                this.advancePhase(room);
            });
        });
    }

    // 安全 Timer
    startTimer(room, seconds, callback) {
        this.clearTimer(room);
        
        const timerId = setTimeout(() => {
            this.withLock(room, () => {
                callback();
            });
        }, seconds * 1000);
        
        this.timers.set(room.code, timerId);
    }

    // 清理 Timer
    clearTimer(room) {
        const timerId = this.timers.get(room.code);
        if (timerId) {
            clearTimeout(timerId);
            this.timers.delete(room.code);
        }
    }

    // 安全执行函数（可重入安全版）
    withLock(room, fn) {
        if (room.lock) return null;
        
        room.lock = true;
        try {
            return fn();
        } catch (err) {
            console.error('Room execution error:', err);
            return null;
        } finally {
            room.lock = false;
        }
    }

    // 检查断线玩家
    checkDisconnectedPlayers(room) {
        const now = Date.now();
        const disconnectedPlayers = [];
        
        room.players.forEach(player => {
            if (!player.connected && player.disconnectTime) {
                const disconnectDuration = now - player.disconnectTime;
                if (disconnectDuration > 60000) { // 60秒超时
                    disconnectedPlayers.push(player);
                }
            }
        });

        disconnectedPlayers.forEach(player => {
            this.forceEliminatePlayer(room, player.id);
        });
    }

    // 强制淘汰断线玩家
    forceEliminatePlayer(room, playerId) {
        const player = room.players.get(playerId);
        if (!player) return;

        player.isAlive = false;
        player.cards = [];
        
        room.gameState.log.push(`${player.name} 长时间未连接，被系统淘汰`);
    }

    // 获取当前玩家
    getCurrentPlayer(room) {
        const currentPlayerId = room.gameState.currentPlayer;
        if (!currentPlayerId) return null;
        return room.players.get(currentPlayerId);
    }

    // advancePhase 开头加断线保护
    advancePhase(room) {
        const currentPlayer = this.getCurrentPlayer(room);
        
        if (currentPlayer && !currentPlayer.connected) {
            console.log(`当前玩家 ${currentPlayer.name} 已断线，自动跳过回合`);
            room.gameState.log.push(`${currentPlayer.name} 已断线，自动跳过回合`);
            this.nextTurn(room);
            return;
        }

        const phase = room.gameState.phase;
        
        // 根据当前阶段推进游戏
        switch (phase.type) {
            case Phase.TURN_START:
                // 回合开始，等待玩家行动
                break;
            case Phase.ACTION_DECLARED:
                // 行动已声明，检查是否需要挑战
                break;
            case Phase.CHALLENGE_WINDOW:
                // 挑战窗口，等待挑战
                break;
            case Phase.COUNTER_WINDOW:
                // 反制窗口，等待反制
                break;
            case Phase.DISCARD:
                // 弃牌阶段，等待弃牌
                break;
            case Phase.RESOLVE:
                // 行动结算
                break;
            case Phase.GAME_OVER:
                // 游戏结束
                break;
        }
    }

    // 初始化游戏
    initializeGame(room) {
        room.gameState.deck = this.initializeDeck();
        room.gameState.discardPile = [];
        room.gameState.turnIndex = 0;
        room.gameState.lastAction = null;
        
        // 发牌
        room.players.forEach(player => {
            player.coins = 2;
            player.cards = [
                this.drawCard(room),
                this.drawCard(room)
            ];
            player.isAlive = true;
        });

        this.setPhase(room, { type: Phase.TURN_START, data: {} });
    }

    // 初始化牌组
    initializeDeck() {
        const roles = ['duke', 'assassin', 'captain', 'ambassador', 'contessa'];
        return roles.flatMap(role => Array(3).fill(role)).sort(() => Math.random() - 0.5);
    }

    // 抽牌
    drawCard(room) {
        if (room.gameState.deck.length === 0) {
            room.gameState.deck = room.gameState.discardPile.sort(() => Math.random() - 0.5);
            room.gameState.discardPile = [];
        }
        return room.gameState.deck.pop();
    }

    // 弃牌
    discardCard(room, playerId, cardIndex) {
        const player = room.players.get(playerId);
        if (!player || !player.isAlive) return false;

        if (cardIndex < 0 || cardIndex >= player.cards.length) return false;

        const card = player.cards.splice(cardIndex, 1)[0];
        room.gameState.discardPile.push(card);

        // 检查是否需要补牌
        if (player.cards.length === 0) {
            player.isAlive = false;
        } else if (player.cards.length < 2) {
            player.cards.push(this.drawCard(room));
        }

        return true;
    }

    // 执行行动
    executeAction(room, playerId, actionType, targetPlayerId) {
        const player = room.players.get(playerId);
        if (!player || !player.isAlive) return null;

        const currentPhase = room.gameState.phase;
        if (currentPhase.type !== Phase.TURN_START) {
            console.log(`执行行动失败: 当前阶段 ${currentPhase.type} 不允许执行行动`);
            return null;
        }

        const currentPlayer = room.gameState.currentPlayer;
        if (currentPlayer !== playerId) {
            console.log(`执行行动失败: 不是玩家 ${playerId} 的回合，当前玩家是 ${currentPlayer}`);
            return null;
        }

        const actionResult = {
            playerId,
            playerName: player.name,
            type: actionType,
            targetPlayerId,
            success: false,
            log: []
        };

        switch (actionType) {
            case 'income':
                player.coins += 1;
                actionResult.success = true;
                actionResult.log.push(`${player.name} 获得收入，+1金币`);
                break;

            case 'foreign_aid':
                actionResult.success = true;
                actionResult.log.push(`${player.name} 寻求外国援助`);
                
                // 检查是否有公爵可以阻止
                const dukePlayers = Array.from(room.players.values())
                    .filter(p => p.isAlive && p.id !== playerId && p.cards.includes('duke'));
                
                if (dukePlayers.length > 0) {
                    room.gameState.counterData = {
                        action: actionResult,
                        blockerRole: 'duke',
                        potentialBlockers: dukePlayers.map(p => p.id)
                    };
                    this.setPhase(room, { type: Phase.COUNTER_WINDOW, data: {} });
                    return actionResult;
                }
                
                player.coins += 2;
                actionResult.log.push(`${player.name} 成功获得2枚金币`);
                break;

            case 'coup':
                if (player.coins < 7) {
                    actionResult.log.push(`${player.name} 金币不足，无法发动政变`);
                    return actionResult;
                }

                const targetPlayer = room.players.get(targetPlayerId);
                if (!targetPlayer || !targetPlayer.isAlive) {
                    actionResult.log.push(`${player.name} 目标玩家不存在或已淘汰`);
                    return actionResult;
                }

                player.coins -= 7;
                actionResult.success = true;
                actionResult.log.push(`${player.name} 发动政变，花费7金币`);
                
                // 目标玩家直接弃牌
                if (targetPlayer.cards.length > 0) {
                    const randomCardIndex = Math.floor(Math.random() * targetPlayer.cards.length);
                    this.discardCard(room, targetPlayerId, randomCardIndex);
                    actionResult.log.push(`${targetPlayer.name} 被迫弃掉一张牌`);
                } else {
                    targetPlayer.isAlive = false;
                    actionResult.log.push(`${targetPlayer.name} 没有卡牌，被淘汰！`);
                }
                break;

            case 'tax':
                actionResult.success = true;
                actionResult.log.push(`${player.name} 声称拥有公爵，征收税金`);
                
                // 如果玩家没有公爵，进入挑战阶段
                if (!player.cards.includes('duke')) {
                    room.gameState.challengeData = {
                        action: actionResult,
                        challengers: new Set()
                    };
                    this.setPhase(room, { type: Phase.CHALLENGE_WINDOW, data: {} });
                    return actionResult;
                }
                
                player.coins += 3;
                actionResult.log.push(`${player.name} 成功征收3枚金币`);
                break;

            case 'assassinate':
                if (player.coins < 3) {
                    actionResult.log.push(`${player.name} 金币不足，无法行刺`);
                    return actionResult;
                }

                const target = room.players.get(targetPlayerId);
                if (!target || !target.isAlive) {
                    actionResult.log.push(`${player.name} 目标玩家不存在或已淘汰`);
                    return actionResult;
                }

                player.coins -= 3;
                actionResult.success = true;
                actionResult.log.push(`${player.name} 声称拥有刺客，行刺 ${target.name}`);
                
                // 检查是否有女伯爵可以阻止
                const contessaPlayers = Array.from(room.players.values())
                    .filter(p => p.isAlive && p.id === targetPlayerId && p.cards.includes('contessa'));
                
                if (contessaPlayers.length > 0) {
                    room.gameState.counterData = {
                        action: actionResult,
                        blockerRole: 'contessa',
                        potentialBlockers: [targetPlayerId]
                    };
                    this.setPhase(room, { type: Phase.COUNTER_WINDOW, data: {} });
                    return actionResult;
                }
                
                // 目标玩家弃牌
                if (target.cards.length > 0) {
                    const randomCardIndex = Math.floor(Math.random() * target.cards.length);
                    this.discardCard(room, targetPlayerId, randomCardIndex);
                    actionResult.log.push(`${target.name} 被行刺，被迫弃掉一张牌`);
                } else {
                    target.isAlive = false;
                    actionResult.log.push(`${target.name} 没有卡牌，被淘汰！`);
                }
                break;

            case 'steal':
                actionResult.success = true;
                actionResult.log.push(`${player.name} 声称拥有队长，试图窃取金币`);
                
                // 检查目标玩家
                const stealTarget = room.players.get(targetPlayerId);
                if (!stealTarget || !stealTarget.isAlive) {
                    actionResult.log.push(`${player.name} 目标玩家不存在或已淘汰`);
                    return actionResult;
                }

                if (stealTarget.coins === 0) {
                    actionResult.log.push(`${stealTarget.name} 没有金币可偷`);
                    break;
                }

                // 如果玩家没有队长，进入挑战阶段
                if (!player.cards.includes('captain')) {
                    room.gameState.challengeData = {
                        action: actionResult,
                        challengers: new Set()
                    };
                    this.setPhase(room, { type: Phase.CHALLENGE_WINDOW, data: {} });
                    return actionResult;
                }
                
                const stealAmount = Math.min(stealTarget.coins, 2);
                stealTarget.coins -= stealAmount;
                player.coins += stealAmount;
                actionResult.log.push(`${player.name} 成功窃取 ${stealAmount} 枚金币`);
                break;

            case 'exchange':
                actionResult.success = true;
                actionResult.log.push(`${player.name} 声称拥有大使，进行卡牌交换`);
                
                // 如果玩家没有大使，进入挑战阶段
                if (!player.cards.includes('ambassador')) {
                    room.gameState.challengeData = {
                        action: actionResult,
                        challengers: new Set()
                    };
                    this.setPhase(room, { type: Phase.CHALLENGE_WINDOW, data: {} });
                    return actionResult;
                }
                
                // 交换卡牌逻辑
                const tempCards = [this.drawCard(room), this.drawCard(room)];
                const exchangeResult = [...player.cards, ...tempCards];
                
                // 这里简化处理，实际应该让玩家选择
                player.cards = exchangeResult.slice(0, 2);
                exchangeResult.slice(2).forEach(card => room.gameState.discardPile.push(card));
                
                actionResult.log.push(`${player.name} 完成卡牌交换`);
                break;
        }

        if (actionResult.success && !room.gameState.challengeData && !room.gameState.counterData) {
            this.nextTurn(room);
        }

        return actionResult;
    }

    // 处理挑战
    handleChallenge(room, challengerId) {
        const phase = room.gameState.phase;
        if (phase.type !== Phase.CHALLENGE_WINDOW) {
            console.log(`处理挑战失败: 当前阶段 ${phase.type} 不是挑战阶段`);
            return null;
        }

        const challengeData = room.gameState.challengeData;
        if (!challengeData) {
            console.log('处理挑战失败: 没有挑战数据');
            return null;
        }

        const challenger = room.players.get(challengerId);
        const actor = room.players.get(challengeData.action.playerId);
        
        if (!challenger || !challenger.isAlive || !actor) {
            console.log('处理挑战失败: 挑战者或行动者不存在');
            return null;
        }

        challengeData.challengers.add(challengerId);
        
        // 立即解决挑战
        const result = this.resolveChallenge(room, challengeData);
        room.gameState.challengeData = null;
        
        return result;
    }

    // 解决挑战
    resolveChallenge(room, challengeData) {
        const action = challengeData.action;
        const actor = room.players.get(action.playerId);
        const challengers = Array.from(challengeData.challengers);
        
        const result = {
            action,
            challengers,
            challengeWon: false,
            log: []
        };

        let requiredRole = '';
        switch (action.type) {
            case 'tax': requiredRole = 'duke'; break;
            case 'assassinate': requiredRole = 'assassin'; break;
            case 'steal': requiredRole = 'captain'; break;
            case 'exchange': requiredRole = 'ambassador'; break;
        }

        if (actor.cards.includes(requiredRole)) {
            // 行动者胜利
            result.challengeWon = false;
            result.log.push(`${actor.name} 确实拥有 ${requiredRole}，挑战失败！`);
            
            // 每个挑战者弃一张牌
            challengers.forEach(challengerId => {
                const challenger = room.players.get(challengerId);
                if (challenger && challenger.isAlive && challenger.cards.length > 0) {
                    const randomIndex = Math.floor(Math.random() * challenger.cards.length);
                    this.discardCard(room, challengerId, randomIndex);
                    result.log.push(`${challenger.name} 挑战失败，被迫弃牌`);
                }
            });
            
            // 行动继续执行
            if (action.type === 'tax') actor.coins += 3;
            else if (action.type === 'steal') {
                const target = room.players.get(action.targetPlayerId);
                if (target && target.coins > 0) {
                    const stealAmount = Math.min(target.coins, 2);
                    target.coins -= stealAmount;
                    actor.coins += stealAmount;
                }
            }
        } else {
            // 挑战者胜利
            result.challengeWon = true;
            result.log.push(`${actor.name} 没有 ${requiredRole}，挑战成功！`);
            
            // 行动者弃一张牌
            if (actor.cards.length > 0) {
                const randomIndex = Math.floor(Math.random() * actor.cards.length);
                this.discardCard(room, action.playerId, randomIndex);
                result.log.push(`${actor.name} 被迫弃牌`);
            }
            
            // 行动被取消
            if (action.type === 'assassinate') actor.coins += 3; // 退还行刺费用
        }

        this.nextTurn(room);
        return result;
    }

    // 处理反制
    handleCounter(room, blockerId, block) {
        const phase = room.gameState.phase;
        if (phase.type !== Phase.COUNTER_WINDOW) return null;

        const counterData = room.gameState.counterData;
        if (!counterData) return null;

        const blocker = room.players.get(blockerId);
        if (!blocker || !blocker.isAlive) return null;

        const result = {
            action: counterData.action,
            blocker: blocker.name,
            blocked: block,
            log: []
        };

        if (block) {
            // 检查是否真的有对应角色
            const hasRole = blocker.cards.includes(counterData.blockerRole);
            
            if (hasRole) {
                result.blocked = true;
                result.log.push(`${blocker.name} 成功阻止了 ${counterData.action.playerName} 的行动`);
                
                // 退还费用
                if (counterData.action.type === 'assassinate') {
                    const actor = room.players.get(counterData.action.playerId);
                    if (actor) actor.coins += 3;
                }
            } else {
                result.blocked = false;
                result.log.push(`${blocker.name} 试图阻止但失败，被迫弃牌`);
                
                // 阻止者弃牌
                if (blocker.cards.length > 0) {
                    const randomIndex = Math.floor(Math.random() * blocker.cards.length);
                    this.discardCard(room, blockerId, randomIndex);
                }
                
                // 原行动继续执行
                const action = counterData.action;
                const actor = room.players.get(action.playerId);
                
                if (action.type === 'foreign_aid') {
                    actor.coins += 2;
                    result.log.push(`${actor.name} 获得2枚金币`);
                } else if (action.type === 'assassinate') {
                    const target = room.players.get(action.targetPlayerId);
                    if (target && target.cards.length > 0) {
                        const randomIndex = Math.floor(Math.random() * target.cards.length);
                        this.discardCard(room, target.id, randomIndex);
                        result.log.push(`${target.name} 被行刺，被迫弃牌`);
                    }
                }
            }
        } else {
            result.blocked = false;
            result.log.push(`${blocker.name} 选择不阻止`);
            
            // 原行动执行
            const action = counterData.action;
            const actor = room.players.get(action.playerId);
            
            if (action.type === 'foreign_aid') {
                actor.coins += 2;
                result.log.push(`${actor.name} 获得2枚金币`);
            } else if (action.type === 'assassinate') {
                const target = room.players.get(action.targetPlayerId);
                if (target && target.cards.length > 0) {
                    const randomIndex = Math.floor(Math.random() * target.cards.length);
                    this.discardCard(room, target.id, randomIndex);
                    result.log.push(`${target.name} 被行刺，被迫弃牌`);
                }
            }
        }

        room.gameState.counterData = null;
        this.nextTurn(room);
        
        return result;
    }

    // 处理弃牌
    handleDiscard(room, playerId, cardIndex) {
        const phase = room.gameState.phase;
        if (phase.type !== Phase.DISCARD) return null;

        const result = this.discardCard(room, playerId, cardIndex);
        if (result) {
            this.nextTurn(room);
        }
        
        return result;
    }

    // 下一回合
    nextTurn(room) {
        // 检查游戏是否结束
        const alivePlayers = Array.from(room.players.values()).filter(p => p.isAlive);
        if (alivePlayers.length <= 1) {
            const winner = alivePlayers[0];
            room.gameState.winner = winner ? winner.id : null;
            this.setPhase(room, { type: Phase.GAME_OVER, data: { winner } });
            return;
        }

        // 找到下一个存活玩家
        let nextIndex = (room.gameState.turnIndex + 1) % room.players.size;
        const playerArray = Array.from(room.players.values());
        
        while (!playerArray[nextIndex].isAlive) {
            nextIndex = (nextIndex + 1) % room.players.size;
        }

        room.gameState.turnIndex = nextIndex;
        room.gameState.currentPlayer = playerArray[nextIndex].id;
        
        // 检查当前玩家是否断线
        const currentPlayer = playerArray[nextIndex];
        if (!currentPlayer.connected) {
            // 断线玩家自动跳过回合
            room.gameState.log.push(`${currentPlayer.name} 已断线，自动跳过回合`);
            this.nextTurn(room);
            return;
        }

        this.setPhase(room, { type: Phase.TURN_START, data: { playerId: currentPlayer.id } });
    }

    // 获取过滤后的游戏状态（隐藏其他玩家的卡牌）
    getFilteredGameState(room, viewerId = null) {
        const state = { ...room.gameState };
        
        // 过滤玩家卡牌信息
        const filteredPlayers = {};
        room.players.forEach((player, id) => {
            filteredPlayers[id] = {
                ...player,
                cards: viewerId === id ? player.cards : Array(player.cards.length).fill('hidden'),
                cardsCount: player.cards.length
            };
        });
        
        return {
            ...state,
            players: filteredPlayers,
            playersList: Array.from(room.players.values()).map(p => ({
                id: p.id,
                name: p.name,
                coins: p.coins,
                cardsCount: p.cards.length,
                isAlive: p.isAlive,
                connected: p.connected || false
            }))
        };
    }
}

module.exports = { GameEngine, Phase };