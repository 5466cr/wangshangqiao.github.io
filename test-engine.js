const { GameEngine, Phase } = require('./engine/GameEngine');

// 测试GameEngine核心功能
class GameEngineTester {
    constructor() {
        this.engine = new GameEngine();
        this.testResults = [];
    }

    // 创建测试房间
    createTestRoom() {
        return {
            code: 'test_room',
            players: new Map([
                ['player1', { id: 'player1', name: 'Alice', coins: 2, cards: ['duke', 'assassin'], isAlive: true, connected: true }],
                ['player2', { id: 'player2', name: 'Bob', coins: 2, cards: ['captain', 'contessa'], isAlive: true, connected: true }]
            ]),
            gameState: {
                status: 'playing',
                turnIndex: 0,
                currentPlayer: 'player1',
                deck: ['ambassador', 'duke', 'assassin', 'captain', 'contessa'],
                discardPile: [],
                lastAction: null,
                phase: { type: Phase.TURN_START, data: {} },
                log: []
            },
            lock: false
        };
    }

    // 测试原子化状态管理
    testAtomicPhaseManagement() {
        console.log('\n=== 测试原子化状态管理 ===');
        
        const room = this.createTestRoom();
        
        // 测试setPhase是否正确清除计时器
        let timerCleared = false;
        this.engine.clearTimer = () => { timerCleared = true; };
        
        this.engine.setPhase(room, { type: Phase.ACTION_DECLARED, data: {} });
        
        const result = timerCleared && room.gameState.phase.type === Phase.ACTION_DECLARED;
        this.testResults.push({ name: '原子化状态管理', passed: result });
        console.log(`结果: ${result ? '通过 ✅' : '失败 ❌'}`);
    }

    // 测试并发安全锁
    testConcurrentSafety() {
        console.log('\n=== 测试并发安全锁 ===');
        
        const room = this.createTestRoom();
        let executionCount = 0;
        
        // 模拟并发执行
        const task1 = () => {
            this.engine.withLock(room, () => {
                executionCount++;
                // 模拟长时间操作
                const start = Date.now();
                while (Date.now() - start < 10) {}
            });
        };
        
        const task2 = () => {
            this.engine.withLock(room, () => {
                executionCount++;
            });
        };
        
        // 同时执行两个任务
        task1();
        task2();
        
        const result = executionCount === 1; // 只有一个应该执行
        this.testResults.push({ name: '并发安全锁', passed: result });
        console.log(`结果: ${result ? '通过 ✅' : '失败 ❌'}`);
        console.log(`执行次数: ${executionCount} (期望: 1)`);
    }

    // 测试计时器管理
    testTimerManagement() {
        console.log('\n=== 测试计时器管理 ===');
        
        const room = this.createTestRoom();
        let timerFired = false;
        
        // 启动计时器
        this.engine.startTimer(room, 0.1, () => {
            timerFired = true;
        });
        
        // 清除计时器
        this.engine.clearTimer(room);
        
        // 等待一小段时间看计时器是否被正确清除
        setTimeout(() => {
            const result = !timerFired;
            this.testResults.push({ name: '计时器清除', passed: result });
            console.log(`结果: ${result ? '通过 ✅' : '失败 ❌'}`);
            console.log(`计时器触发: ${timerFired} (期望: false)`);
            
            this.testTimerSafety();
        }, 200);
    }

    // 测试计时器安全（在锁内执行）
    testTimerSafety() {
        console.log('\n=== 测试计时器安全 ===');
        
        const room = this.createTestRoom();
        room.lock = true; // 模拟房间被锁定
        let timerFired = false;
        
        // 启动计时器
        this.engine.startTimer(room, 0.1, () => {
            timerFired = true;
        });
        
        setTimeout(() => {
            const result = !timerFired;
            this.testResults.push({ name: '计时器锁安全', passed: result });
            console.log(`结果: ${result ? '通过 ✅' : '失败 ❌'}`);
            console.log(`计时器在锁内触发: ${timerFired} (期望: false)`);
            
            this.testDisconnectedPlayerHandling();
        }, 200);
    }

    // 测试断线玩家处理
    testDisconnectedPlayerHandling() {
        console.log('\n=== 测试断线玩家处理 ===');
        
        const room = this.createTestRoom();
        const disconnectedPlayer = room.players.get('player1');
        disconnectedPlayer.connected = false;
        disconnectedPlayer.disconnectTime = Date.now() - 70000; // 70秒前断线
        
        this.engine.checkDisconnectedPlayers(room);
        
        const result = !disconnectedPlayer.isAlive;
        this.testResults.push({ name: '断线玩家淘汰', passed: result });
        console.log(`结果: ${result ? '通过 ✅' : '失败 ❌'}`);
        console.log(`断线玩家状态: ${disconnectedPlayer.isAlive ? '存活' : '淘汰'} (期望: 淘汰)`);
        
        this.testActionExecution();
    }

    // 测试行动执行
    testActionExecution() {
        console.log('\n=== 测试行动执行 ===');
        
        const room = this.createTestRoom();
        room.gameState.currentPlayer = 'player1';
        
        const actionResult = this.engine.executeAction(room, 'player1', 'income', null);
        
        const result = actionResult && actionResult.success && room.players.get('player1').coins === 3;
        this.testResults.push({ name: '基本行动执行', passed: result });
        console.log(`结果: ${result ? '通过 ✅' : '失败 ❌'}`);
        console.log(`金币数量: ${room.players.get('player1').coins} (期望: 3)`);
        
        this.testChallengeMechanism();
    }

    // 测试挑战机制
    testChallengeMechanism() {
        console.log('\n=== 测试挑战机制 ===');
        
        const room = this.createTestRoom();
        room.gameState.currentPlayer = 'player1';
        
        // 移除公爵卡牌，让玩家谎称公爵
        room.players.get('player1').cards = ['assassin', 'captain'];
        
        const actionResult = this.engine.executeAction(room, 'player1', 'tax', null);
        
        // 检查是否进入挑战阶段
        const phaseResult = room.gameState.phase.type === Phase.CHALLENGE_WINDOW;
        
        // 测试挑战处理
        const challengeResult = this.engine.handleChallenge(room, 'player2');
        const challengeWon = challengeResult && challengeResult.challengeWon;
        
        this.testResults.push({ name: '挑战机制', passed: phaseResult && challengeWon });
        console.log(`结果: ${phaseResult && challengeWon ? '通过 ✅' : '失败 ❌'}`);
        console.log(`挑战阶段: ${phaseResult}, 挑战成功: ${challengeWon}`);
        
        this.testCounterMechanism();
    }

    // 测试反制机制
    testCounterMechanism() {
        console.log('\n=== 测试反制机制 ===');
        
        const room = this.createTestRoom();
        room.gameState.currentPlayer = 'player1';
        
        const actionResult = this.engine.executeAction(room, 'player1', 'foreign_aid', null);
        
        // 检查是否进入反制阶段
        const phaseResult = room.gameState.phase.type === Phase.COUNTER_WINDOW;
        
        // 测试反制处理
        const counterResult = this.engine.handleCounter(room, 'player2', true);
        const blocked = counterResult && counterResult.blocked;
        
        this.testResults.push({ name: '反制机制', passed: phaseResult && blocked });
        console.log(`结果: ${phaseResult && blocked ? '通过 ✅' : '失败 ❌'}`);
        console.log(`反制阶段: ${phaseResult}, 反制成功: ${blocked}`);
        
        this.showSummary();
    }

    // 显示测试总结
    showSummary() {
        console.log('\n=== 测试总结 ===');
        
        const passedTests = this.testResults.filter(t => t.passed).length;
        const totalTests = this.testResults.length;
        
        console.log(`通过测试: ${passedTests}/${totalTests}`);
        
        this.testResults.forEach(test => {
            console.log(`${test.name}: ${test.passed ? '✅ 通过' : '❌ 失败'}`);
        });
        
        const successRate = (passedTests / totalTests * 100).toFixed(1);
        console.log(`\n成功率: ${successRate}%`);
        
        if (passedTests === totalTests) {
            console.log('\n🎉 所有测试通过！GameEngine工作正常。');
        } else {
            console.log('\n⚠️  部分测试失败，需要进一步调试。');
        }
    }

    // 运行所有测试
    runAllTests() {
        console.log('开始测试GameEngine...');
        
        this.testAtomicPhaseManagement();
        this.testConcurrentSafety();
        this.testTimerManagement();
        
        // 其他测试会在setTimeout回调中依次执行
    }
}

// 运行测试
const tester = new GameEngineTester();
tester.runAllTests();

// 导出测试器供其他测试使用
module.exports = GameEngineTester;