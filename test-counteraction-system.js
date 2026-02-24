// 反制系统测试脚本
// 这个脚本用于验证政变游戏反制系统的完整流程

const assert = require('assert');

// 模拟游戏管理器的核心方法
class TestGameManager {
    constructor() {
        this.rooms = new Map();
        this.testRoom = null;
        this.actionLog = [];
    }

    // 创建测试房间
    createTestRoom() {
        const room = {
            roomCode: 'TEST',
            players: new Map(),
            gameState: {
                status: 'playing',
                deck: ['duke', 'assassin', 'captain', 'ambassador', 'contessa', 'duke', 'assassin', 'captain', 'ambassador', 'contessa'],
                discardPile: [],
                challengePhase: null,
                counteractionPhase: null,
                lastAction: null
            }
        };

        // 创建测试玩家
        const playerA = {
            id: 'playerA',
            name: '玩家A',
            coins: 10,
            cards: ['captain'], // 船长
            isAlive: true
        };

        const playerB = {
            id: 'playerB',
            name: '玩家B',
            coins: 5,
            cards: ['ambassador'], // 大使
            isAlive: true
        };

        const playerC = {
            id: 'playerC',
            name: '玩家C',
            coins: 8,
            cards: ['duke'], // 公爵
            isAlive: true
        };

        const playerD = {
            id: 'playerD',
            name: '玩家D',
            coins: 3,
            cards: ['contessa'], // 女爵
            isAlive: true
        };

        room.players.set(playerA.id, playerA);
        room.players.set(playerB.id, playerB);
        room.players.set(playerC.id, playerC);
        room.players.set(playerD.id, playerD);

        this.rooms.set(room.roomCode, room);
        this.testRoom = room;

        return room;
    }

    // 获取行动所需角色
    getRequiredRole(action) {
        const roleMap = {
            'tax': 'duke',
            'assassinate': 'assassin',
            'steal': 'captain',
            'exchange': 'ambassador'
        };
        return roleMap[action];
    }

    // 获取行动文本描述
    getActionText(action) {
        const textMap = {
            'income': '收入',
            'foreign_aid': '外国援助',
            'coup': '政变',
            'tax': '征税',
            'assassinate': '刺杀',
            'steal': '偷窃',
            'exchange': '交换'
        };
        return textMap[action] || action;
    }

    // 检查是否需要反制
    checkForCounteraction(room, actionResult) {
        console.log('\n=== 检查反制阶段 ===');
        const action = actionResult.action;
        const player = room.players.get(actionResult.playerId);
        
        let counteractionPhase = null;
        
        switch (action) {
            case 'foreign_aid':
                console.log(`${player.name} 使用了外国援助，检查是否有公爵可以反制...`);
                // 公爵可以反制外国援助
                const dukePlayers = Array.from(room.players.values()).filter(p => 
                    p.id !== player.id && p.isAlive && p.cards.includes('duke')
                );
                
                if (dukePlayers.length > 0) {
                    console.log(`发现 ${dukePlayers.length} 个公爵玩家可以反制`);
                    counteractionPhase = {
                        action: actionResult,
                        counterRole: 'duke',
                        potentialCounters: dukePlayers.map(p => p.id),
                        counterResponses: new Map(),
                        timestamp: Date.now(),
                        countdown: 15,
                        description: '公爵可以阻止外国援助'
                    };
                }
                break;
                
            case 'assassinate':
                console.log(`${player.name} 使用了刺杀，检查目标是否有女爵可以反制...`);
                // 女爵可以反制刺杀
                const target = room.players.get(actionResult.targetPlayerId);
                if (target && target.isAlive && target.cards.includes('contessa')) {
                    console.log(`目标 ${target.name} 有女爵，可以反制`);
                    counteractionPhase = {
                        action: actionResult,
                        counterRole: 'contessa',
                        potentialCounters: [target.id],
                        counterResponses: new Map(),
                        timestamp: Date.now(),
                        countdown: 15,
                        description: '女爵可以阻止刺杀'
                    };
                }
                break;
                
            case 'steal':
                console.log(`${player.name} 使用了偷窃，检查目标是否有船长或大使可以反制...`);
                // 船长或大使可以反制偷窃
                const stealTarget = room.players.get(actionResult.targetPlayerId);
                if (stealTarget && stealTarget.isAlive && 
                    (stealTarget.cards.includes('captain') || stealTarget.cards.includes('ambassador'))) {
                    console.log(`目标 ${stealTarget.name} 有 ${stealTarget.cards.includes('captain') ? '船长' : '大使'}，可以反制`);
                    counteractionPhase = {
                        action: actionResult,
                        counterRole: stealTarget.cards.includes('captain') ? 'captain' : 'ambassador',
                        potentialCounters: [stealTarget.id],
                        counterResponses: new Map(),
                        timestamp: Date.now(),
                        countdown: 15,
                        description: '船长或大使可以阻止偷窃'
                    };
                }
                break;
                
            default:
                console.log(`${action} 行动不可反制`);
                break;
        }
        
        if (counteractionPhase) {
            console.log('进入反制阶段');
            room.gameState.counteractionPhase = counteractionPhase;
            this.simulateCounteractionPhase(room, counteractionPhase);
            return true;
        } else {
            console.log('没有反制，直接执行原行动');
            this.executeOriginalAction(room, actionResult);
            return false;
        }
    }

    // 模拟反制阶段
    simulateCounteractionPhase(room, counteractionPhase) {
        const actionResult = counteractionPhase.action;
        const player = room.players.get(actionResult.playerId);
        
        console.log(`\n=== 反制阶段开始 ===`);
        console.log(`行动: ${this.getActionText(actionResult.action)}`);
        console.log(`执行者: ${player.name}`);
        console.log(`可反制角色: ${counteractionPhase.counterRole}`);
        console.log(`可反制玩家: ${counteractionPhase.potentialCounters.map(id => room.players.get(id).name).join(', ')}`);
        
        // 模拟玩家选择反制（这里假设第一个可反制的玩家选择反制）
        if (counteractionPhase.potentialCounters.length > 0) {
            const counterPlayerId = counteractionPhase.potentialCounters[0];
            const counterPlayer = room.players.get(counterPlayerId);
            
            console.log(`\n${counterPlayer.name} 选择反制！`);
            console.log(`${counterPlayer.name} 声明拥有 ${counteractionPhase.counterRole}`);
            
            // 记录反制响应
            counteractionPhase.counterResponses.set(counterPlayerId, { counter: true, timestamp: Date.now() });
            
            // 进入对反制的挑战阶段
            this.startCounteractionChallenge(room, counteractionPhase, counterPlayerId);
        } else {
            console.log('没有玩家可以反制');
            this.resolveCounteractionPhase(room);
        }
    }

    // 开始对反制的挑战
    startCounteractionChallenge(room, counteractionPhase, counterPlayerId) {
        console.log(`\n=== 对反制的挑战阶段开始 ===`);
        
        const actionResult = counteractionPhase.action;
        const originalPlayer = room.players.get(actionResult.playerId);
        const counterPlayer = room.players.get(counterPlayerId);
        
        console.log(`${originalPlayer.name} 可以挑战 ${counterPlayer.name} 是否真的有 ${counteractionPhase.counterRole}`);
        
        // 模拟原始玩家选择挑战
        const challenge = true;
        console.log(`${originalPlayer.name} 选择挑战！`);
        
        if (challenge) {
            // 检查反制玩家是否真的有声称的角色
            const hasRole = counterPlayer.cards.includes(counteractionPhase.counterRole);
            
            if (hasRole) {
                console.log(`挑战失败！${counterPlayer.name} 确实有 ${counteractionPhase.counterRole}`);
                console.log(`${originalPlayer.name} 需要弃牌`);
                
                // 挑战失败，挑战者弃牌
                if (originalPlayer.cards.length > 0) {
                    const cardIndex = Math.floor(Math.random() * originalPlayer.cards.length);
                    const discardedCard = originalPlayer.cards.splice(cardIndex, 1)[0];
                    room.gameState.discardPile.push(discardedCard);
                    console.log(`${originalPlayer.name} 弃掉了 ${discardedCard}`);
                }
                
                // 反制成功，行动被阻止
                actionResult.log.push(`${counterPlayer.name} 成功反制了 ${this.getActionText(actionResult.action)}`);
                actionResult.success = false;
                
            } else {
                console.log(`挑战成功！${counterPlayer.name} 没有 ${counteractionPhase.counterRole}`);
                console.log(`${counterPlayer.name} 需要弃牌`);
                
                // 挑战成功，反制者弃牌
                if (counterPlayer.cards.length > 0) {
                    const cardIndex = Math.floor(Math.random() * counterPlayer.cards.length);
                    const discardedCard = counterPlayer.cards.splice(cardIndex, 1)[0];
                    room.gameState.discardPile.push(discardedCard);
                    console.log(`${counterPlayer.name} 弃掉了 ${discardedCard}`);
                }
                
                // 反制失败，原行动继续
                actionResult.log.push(`${originalPlayer.name} 挑战成功，${counterPlayer.name} 无法反制`);
                actionResult.success = true;
                
                // 执行原行动
                this.executeOriginalAction(room, actionResult);
            }
        } else {
            console.log(`${originalPlayer.name} 选择不挑战`);
            // 反制成功，行动被阻止
            actionResult.log.push(`${counterPlayer.name} 成功反制了 ${this.getActionText(actionResult.action)}`);
            actionResult.success = false;
        }
        
        // 清除反制阶段
        room.gameState.counteractionPhase = null;
        
        console.log(`\n=== 反制流程结束 ===`);
        console.log(`行动结果: ${actionResult.success ? '成功' : '失败'}`);
        console.log(`日志: ${actionResult.log.join(', ')}`);
    }

    // 处理反制结果
    resolveCounteractionPhase(room) {
        const counteractionPhase = room.gameState.counteractionPhase;
        if (!counteractionPhase) return;

        const actionResult = counteractionPhase.action;
        const hasCounters = Array.from(counteractionPhase.counterResponses.values()).some(response => response.counter);

        if (hasCounters) {
            // 有玩家选择反制
            const counters = Array.from(counteractionPhase.counterResponses.entries())
                .filter(([_, response]) => response.counter)
                .map(([counterId]) => counterId);

            const counterNames = counters.map(id => room.players.get(id)?.name || 'Unknown').join('、');
            
            actionResult.log.push(`${counterNames} 使用 ${counteractionPhase.counterRole} 反制了 ${this.getActionText(actionResult.action)}`);
            
            // 这里应该进入对反制的挑战阶段
            console.log('需要进入对反制的挑战阶段');
        } else {
            // 没有反制，执行原行动
            this.executeOriginalAction(room, actionResult);
        }

        // 清除反制阶段
        room.gameState.counteractionPhase = null;
    }

    // 执行原始行动
    executeOriginalAction(room, actionResult) {
        console.log(`\n=== 执行行动: ${this.getActionText(actionResult.action)} ===`);
        
        const action = actionResult.action;
        const player = room.players.get(actionResult.playerId);
        const target = actionResult.targetPlayerId ? room.players.get(actionResult.targetPlayerId) : null;

        switch (action) {
            case 'income':
                player.coins += 1;
                actionResult.log.push(`${player.name} 获得了 1 个金币`);
                break;
                
            case 'foreign_aid':
                player.coins += 2;
                actionResult.log.push(`${player.name} 获得了 2 个金币（外国援助）`);
                break;
                
            case 'coup':
                if (target) {
                    if (target.cards.length > 0) {
                        const cardIndex = Math.floor(Math.random() * target.cards.length);
                        const discardedCard = target.cards.splice(cardIndex, 1)[0];
                        room.gameState.discardPile.push(discardedCard);
                        actionResult.log.push(`${target.name} 被政变，弃掉了 ${discardedCard} 卡牌`);
                    }
                }
                break;
                
            case 'tax':
                player.coins += 3;
                actionResult.log.push(`${player.name} 征收了 3 个金币的税`);
                break;
                
            case 'assassinate':
                if (target && target.isAlive && target.cards.length > 0) {
                    const cardIndex = Math.floor(Math.random() * target.cards.length);
                    const discardedCard = target.cards.splice(cardIndex, 1)[0];
                    room.gameState.discardPile.push(discardedCard);
                    actionResult.log.push(`${target.name} 被刺杀，弃掉了 ${discardedCard} 卡牌`);
                }
                break;
                
            case 'steal':
                if (target && target.isAlive) {
                    const stealAmount = Math.min(2, target.coins);
                    if (stealAmount > 0) {
                        player.coins += stealAmount;
                        target.coins -= stealAmount;
                        actionResult.log.push(`${player.name} 从 ${target.name} 那里偷取了 ${stealAmount} 个金币`);
                    } else {
                        actionResult.log.push(`${target.name} 没有金币可以偷取`);
                    }
                }
                break;
                
            case 'exchange':
                actionResult.log.push(`${player.name} 交换了卡牌`);
                break;
        }

        console.log(`行动执行完成`);
        console.log(`日志: ${actionResult.log.join(', ')}`);
        
        // 显示玩家状态
        this.showPlayerStatus(room);
    }

    // 显示玩家状态
    showPlayerStatus(room) {
        console.log('\n=== 玩家状态 ===');
        room.players.forEach(player => {
            console.log(`${player.name}: ${player.coins}金币, 卡牌:[${player.cards.join(', ')}], 存活:${player.isAlive}`);
        });
    }

    // 测试偷窃反制流程
    testStealCounteraction() {
        console.log('\n\n========================================');
        console.log('测试场景1: 偷窃反制流程');
        console.log('========================================');
        
        const room = this.createTestRoom();
        console.log('初始状态:');
        this.showPlayerStatus(room);
        
        // 玩家A偷玩家B的钱
        const actionResult = {
            action: 'steal',
            playerId: 'playerA',
            targetPlayerId: 'playerB',
            log: [],
            success: true
        };
        
        console.log('\n玩家A尝试偷玩家B的钱...');
        this.checkForCounteraction(room, actionResult);
    }

    // 测试刺杀反制流程
    testAssassinateCounteraction() {
        console.log('\n\n========================================');
        console.log('测试场景2: 刺杀反制流程');
        console.log('========================================');
        
        const room = this.createTestRoom();
        console.log('初始状态:');
        this.showPlayerStatus(room);
        
        // 玩家A刺杀玩家D
        const actionResult = {
            action: 'assassinate',
            playerId: 'playerA',
            targetPlayerId: 'playerD',
            log: [],
            success: true
        };
        
        console.log('\n玩家A尝试刺杀玩家D...');
        this.checkForCounteraction(room, actionResult);
    }

    // 测试外国援助反制流程
    testForeignAidCounteraction() {
        console.log('\n\n========================================');
        console.log('测试场景3: 外国援助反制流程');
        console.log('========================================');
        
        const room = this.createTestRoom();
        console.log('初始状态:');
        this.showPlayerStatus(room);
        
        // 玩家A使用外国援助
        const actionResult = {
            action: 'foreign_aid',
            playerId: 'playerA',
            log: [],
            success: true
        };
        
        console.log('\n玩家A尝试使用外国援助...');
        this.checkForCounteraction(room, actionResult);
    }

    // 运行所有测试
    runAllTests() {
        console.log('开始反制系统测试...');
        
        this.testStealCounteraction();
        this.testAssassinateCounteraction();
        this.testForeignAidCounteraction();
        
        console.log('\n\n========================================');
        console.log('所有测试完成！');
        console.log('========================================');
    }
}

// 运行测试
const testManager = new TestGameManager();
testManager.runAllTests();