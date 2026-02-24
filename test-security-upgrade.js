const { GameEngine, Phase } = require('./engine/GameEngine');

// 安全升级验证测试
class SecurityUpgradeTester {
    constructor() {
        this.engine = new GameEngine();
        this.testResults = [];
    }

    // 创建测试房间
    createTestRoom() {
        return {
            code: 'security_test',
            players: new Map([
                ['player1', { id: 'player1', name: 'Alice', coins: 10, cards: ['duke', 'assassin'], isAlive: true, connected: true }],
                ['player2', { id: 'player2', name: 'Bob', coins: 5, cards: ['captain', 'contessa'], isAlive: true, connected: true }],
                ['player3', { id: 'player3', name: 'Charlie', coins: 3, cards: ['ambassador', 'captain'], isAlive: true, connected: true }]
            ]),
            gameState: {
                status: 'playing',
                turnIndex: 0,
                currentPlayer: 'player1',
                deck: ['duke', 'assassin', 'captain', 'ambassador', 'contessa'],
                discardPile: [],
                lastAction: null,
                phase: { type: Phase.TURN_START, data: {} },
                log: [],
                challengeData: null,
                counterData: null
            },
            lock: false,
            timer: null
        };
    }

    // 测试1: 原子化状态管理
    testAtomicPhaseManagement() {
        console.log('\n🔒 测试1: 原子化状态管理');
        
        const room = this.createTestRoom();
        
        // 记录原始的clearTimer方法
        const originalClearTimer = this.engine.clearTimer;
        let clearTimerCalled = false;
        
        // 替换clearTimer方法来检测调用
        this.engine.clearTimer = (r) => {
            clearTimerCalled = true;
            originalClearTimer.call(this.engine, r);
        };
        
        // 使用setPhase改变状态
        this.engine.setPhase(room, { type: Phase.ACTION_DECLARED, data: { action: 'test' } });
        
        const phaseChanged = room.gameState.phase.type === Phase.ACTION_DECLARED;
        const timerCleared = clearTimerCalled;
        
        const result = phaseChanged && timerCleared;
        this.testResults.push({ name: '原子化状态管理', passed: result });
        
        console.log(`  状态更新: ${phaseChanged ? '✅' : '❌'}`);
        console.log(`  计时器清除: ${timerCleared ? '✅' : '❌'}`);
        console.log(`  结果: ${result ? '✅ 通过' : '❌ 失败'}`);
        
        // 恢复原始方法
        this.engine.clearTimer = originalClearTimer;
        
        this.testConcurrentSafety();
    }

    // 测试2: 并发安全锁
    testConcurrentSafety() {
        console.log('\n🔒 测试2: 并发安全锁');
        
        const room = this.createTestRoom();
        let executionCount = 0;
        let exceptionThrown = false;
        
        // 模拟并发挑战
        const challengeFunction = (playerId) => {
            this.engine.withLock(room, () => {
                executionCount++;
                // 模拟长时间操作
                const start = Date.now();
                while (Date.now() - start < 20) {}
                return { success: true, playerId };
            });
        };
        
        try {
            // 模拟两个玩家同时挑战
            const result1 = challengeFunction('player2');
            const result2 = challengeFunction('player3');
            
            // 第二个应该被拒绝
            const secondRejected = !result2;
            const onlyOneExecuted = executionCount === 1;
            
            const result = onlyOneExecuted && secondRejected;
            this.testResults.push({ name: '并发安全锁', passed: result });
            
            console.log(`  执行次数: ${executionCount} (期望: 1)`);
            console.log(`  第二次调用被拒绝: ${secondRejected ? '✅' : '❌'}`);
            console.log(`  结果: ${result ? '✅ 通过' : '❌ 失败'}`);
            
        } catch (error) {
            exceptionThrown = true;
            console.log(`  测试异常: ${error.message}`);
            this.testResults.push({ name: '并发安全锁', passed: false });
        }
        
        this.testPhaseValidation();
    }

    // 测试3: 阶段验证
    testPhaseValidation() {
        console.log('\n🔒 测试3: 阶段验证');
        
        const room = this.createTestRoom();
        
        // 设置错误的阶段
        this.engine.setPhase(room, { type: Phase.CHALLENGE_WINDOW, data: {} });
        
        // 尝试在挑战阶段执行行动
        const actionResult = this.engine.executeAction(room, 'player1', 'income', null);
        
        const result = !actionResult;
        this.testResults.push({ name: '阶段验证', passed: result });
        
        console.log(`  错误阶段的行动被拒绝: ${result ? '✅' : '❌'}`);
        console.log(`  结果: ${result ? '✅ 通过' : '❌ 失败'}`);
        
        this.testTimerSafety();
    }

    // 测试4: 计时器安全
    testTimerSafety() {
        console.log('\n🔒 测试4: 计时器安全');
        
        const room = this.createTestRoom();
        let timerExecuted = false;
        
        // 锁定房间
        room.lock = true;
        
        // 启动计时器
        this.engine.startTimer(room, 0.1, () => {
            timerExecuted = true;
        });
        
        setTimeout(() => {
            const result = !timerExecuted;
            this.testResults.push({ name: '计时器安全', passed: result });
            
            console.log(`  锁状态下计时器不执行: ${result ? '✅' : '❌'}`);
            console.log(`  结果: ${result ? '✅ 通过' : '❌ 失败'}`);
            
            this.testDisconnectedPlayerTimeout();
        }, 200);
    }

    // 测试5: 断线玩家超时
    testDisconnectedPlayerTimeout() {
        console.log('\n🔒 测试5: 断线玩家超时');
        
        const room = this.createTestRoom();
        const disconnectedPlayer = room.players.get('player2');
        
        // 设置玩家断线
        disconnectedPlayer.connected = false;
        disconnectedPlayer.disconnectTime = Date.now() - 65000; // 65秒前断线
        
        // 检查断线玩家
        this.engine.checkDisconnectedPlayers(room);
        
        const result = !disconnectedPlayer.isAlive;
        this.testResults.push({ name: '断线玩家超时', passed: result });
        
        console.log(`  断线玩家被淘汰: ${result ? '✅' : '❌'}`);
        console.log(`  玩家状态: ${disconnectedPlayer.isAlive ? '存活' : '淘汰'}`);
        console.log(`  结果: ${result ? '✅ 通过' : '❌ 失败'}`);
        
        this.testChallengeResolutionSafety();
    }

    // 测试6: 挑战解决安全
    testChallengeResolutionSafety() {
        console.log('\n🔒 测试6: 挑战解决安全');
        
        const room = this.createTestRoom();
        
        // 设置挑战数据
        room.gameState.challengeData = {
            action: { playerId: 'player1', type: 'tax', playerName: 'Alice' },
            challengers: new Set(['player2', 'player3'])
        };
        
        let executionCount = 0;
        
        // 模拟并发挑战解决
        const resolveChallenge = () => {
            this.engine.withLock(room, () => {
                executionCount++;
                return { success: true };
            });
        };
        
        const result1 = resolveChallenge();
        const result2 = resolveChallenge();
        
        const result = executionCount === 1;
        this.testResults.push({ name: '挑战解决安全', passed: result });
        
        console.log(`  挑战解决执行次数: ${executionCount} (期望: 1)`);
        console.log(`  结果: ${result ? '✅ 通过' : '❌ 失败'}`);
        
        this.testActionValidation();
    }

    // 测试7: 行动验证
    testActionValidation() {
        console.log('\n🔒 测试7: 行动验证');
        
        const room = this.createTestRoom();
        
        // 设置不是当前玩家的回合
        room.gameState.currentPlayer = 'player2';
        
        // 玩家1尝试执行行动
        const actionResult = this.engine.executeAction(room, 'player1', 'income', null);
        
        const result = !actionResult;
        this.testResults.push({ name: '行动验证', passed: result });
        
        console.log(`  非当前玩家行动被拒绝: ${result ? '✅' : '❌'}`);
        console.log(`  结果: ${result ? '✅ 通过' : '❌ 失败'}`);
        
        this.showSecuritySummary();
    }

    // 显示安全测试总结
    showSecuritySummary() {
        console.log('\n🛡️  安全升级验证总结');
        console.log('=' .repeat(50));
        
        const passedTests = this.testResults.filter(t => t.passed).length;
        const totalTests = this.testResults.length;
        
        console.log(`\n通过测试: ${passedTests}/${totalTests}`);
        console.log('\n测试详情:');
        
        this.testResults.forEach((test, index) => {
            console.log(`${index + 1}. ${test.name}: ${test.passed ? '✅ 通过' : '❌ 失败'}`);
        });
        
        const successRate = (passedTests / totalTests * 100).toFixed(1);
        console.log(`\n安全评分: ${successRate}%`);
        
        if (passedTests === totalTests) {
            console.log('\n🎉 所有安全测试通过！系统已达到生产级安全标准。');
            console.log('\n✅ 已解决的核心问题:');
            console.log('  - 原子化状态管理，消除幽灵Bug');
            console.log('  - 并发安全锁，防止双挑战/双弃牌');
            console.log('  - 统一计时器管理，避免计时器冲突');
            console.log('  - 严格阶段验证，防止非法操作');
            console.log('  - 断线玩家超时处理，避免房间卡死');
        } else {
            console.log('\n⚠️  存在安全隐患，建议进一步修复后再上线。');
            
            const failedTests = this.testResults.filter(t => !t.passed);
            console.log('\n❌ 失败的测试:');
            failedTests.forEach(test => {
                console.log(`  - ${test.name}`);
            });
        }
        
        console.log('\n' + '=' .repeat(50));
    }

    // 运行所有安全测试
    runSecurityTests() {
        console.log('🚀 开始安全升级验证测试...');
        console.log('目标: 验证生产级安全机制\n');
        
        this.testAtomicPhaseManagement();
    }
}

// 运行安全测试
const securityTester = new SecurityUpgradeTester();

// 延迟运行以确保所有异步操作完成
setTimeout(() => {
    securityTester.runSecurityTests();
}, 100);

// 导出测试器
module.exports = SecurityUpgradeTester;