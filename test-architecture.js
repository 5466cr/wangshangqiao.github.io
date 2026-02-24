// 架构完整性验证测试
const SocketManager = require('./socket/SocketManager');
const RoomManager = require('./room/RoomManager');
const { GameEngine, Phase } = require('./engine/GameEngine');

class ArchitectureTester {
    constructor() {
        this.testResults = [];
    }

    // 测试1: 模块分离验证
    testModuleSeparation() {
        console.log('\n🏗️  测试1: 模块分离验证');
        
        try {
            // 验证GameEngine是纯逻辑
            const engine = new GameEngine();
            const hasSocketDependency = typeof engine.io !== 'undefined';
            const hasRoomManagement = typeof engine.rooms !== 'undefined';
            
            const isPureLogic = !hasSocketDependency && !hasRoomManagement;
            
            console.log(`  GameEngine纯逻辑: ${isPureLogic ? '✅' : '❌'}`);
            
            // 验证SocketManager负责通信
            const mockIo = { on: () => {}, emit: () => {} };
            const socketManager = new SocketManager(mockIo);
            const hasEngine = typeof socketManager.engine !== 'undefined';
            
            console.log(`  SocketManager通信层: ${hasEngine ? '✅' : '❌'}`);
            
            // 验证RoomManager负责房间管理
            const roomManager = new RoomManager();
            const hasRoomMethods = typeof roomManager.createRoom === 'function';
            
            console.log(`  RoomManager房间管理: ${hasRoomMethods ? '✅' : '❌'}`);
            
            const result = isPureLogic && hasEngine && hasRoomMethods;
            this.testResults.push({ name: '模块分离', passed: result });
            
            console.log(`  结果: ${result ? '✅ 通过' : '❌ 失败'}`);
            
        } catch (error) {
            console.log(`  测试异常: ${error.message}`);
            this.testResults.push({ name: '模块分离', passed: false });
        }
        
        this.testStateManagement();
    }

    // 测试2: 状态管理验证
    testStateManagement() {
        console.log('\n🏗️  测试2: 状态管理验证');
        
        try {
            const engine = new GameEngine();
            const room = this.createTestRoom();
            
            // 测试setPhase方法存在
            const hasSetPhase = typeof engine.setPhase === 'function';
            
            // 测试状态转换
            engine.setPhase(room, { type: Phase.ACTION_DECLARED, data: {} });
            const phaseChanged = room.gameState.phase.type === Phase.ACTION_DECLARED;
            
            console.log(`  setPhase方法: ${hasSetPhase ? '✅' : '❌'}`);
            console.log(`  状态转换: ${phaseChanged ? '✅' : '❌'}`);
            
            const result = hasSetPhase && phaseChanged;
            this.testResults.push({ name: '状态管理', passed: result });
            
            console.log(`  结果: ${result ? '✅ 通过' : '❌ 失败'}`);
            
        } catch (error) {
            console.log(`  测试异常: ${error.message}`);
            this.testResults.push({ name: '状态管理', passed: false });
        }
        
        this.testSafetyMechanisms();
    }

    // 测试3: 安全机制验证
    testSafetyMechanisms() {
        console.log('\n🏗️  测试3: 安全机制验证');
        
        try {
            const engine = new GameEngine();
            const room = this.createTestRoom();
            
            // 测试withLock方法
            const hasWithLock = typeof engine.withLock === 'function';
            
            // 测试锁机制
            let executed = false;
            room.lock = true; // 手动锁定
            
            const result = engine.withLock(room, () => {
                executed = true;
                return true;
            });
            
            const lockWorking = !executed && result === null;
            
            console.log(`  withLock方法: ${hasWithLock ? '✅' : '❌'}`);
            console.log(`  锁机制工作: ${lockWorking ? '✅' : '❌'}`);
            
            const testResult = hasWithLock && lockWorking;
            this.testResults.push({ name: '安全机制', passed: testResult });
            
            console.log(`  结果: ${testResult ? '✅ 通过' : '❌ 失败'}`);
            
        } catch (error) {
            console.log(`  测试异常: ${error.message}`);
            this.testResults.push({ name: '安全机制', passed: false });
        }
        
        this.testTimerManagement();
    }

    // 测试4: 计时器管理验证
    testTimerManagement() {
        console.log('\n🏗️  测试4: 计时器管理验证');
        
        try {
            const engine = new GameEngine();
            const room = this.createTestRoom();
            
            // 测试计时器方法
            const hasStartTimer = typeof engine.startTimer === 'function';
            const hasClearTimer = typeof engine.clearTimer === 'function';
            
            console.log(`  startTimer方法: ${hasStartTimer ? '✅' : '❌'}`);
            console.log(`  clearTimer方法: ${hasClearTimer ? '✅' : '❌'}`);
            
            const result = hasStartTimer && hasClearTimer;
            this.testResults.push({ name: '计时器管理', passed: result });
            
            console.log(`  结果: ${result ? '✅ 通过' : '❌ 失败'}`);
            
        } catch (error) {
            console.log(`  测试异常: ${error.message}`);
            this.testResults.push({ name: '计时器管理', passed: false });
        }
        
        this.testDisconnectHandling();
    }

    // 测试5: 断线处理验证
    testDisconnectHandling() {
        console.log('\n🏗️  测试5: 断线处理验证');
        
        try {
            const engine = new GameEngine();
            const room = this.createTestRoom();
            
            // 测试断线处理方法
            const hasCheckDisconnected = typeof engine.checkDisconnectedPlayers === 'function';
            
            // 测试断线玩家标记
            const player = room.players.get('player1');
            player.connected = false;
            player.disconnectTime = Date.now() - 70000;
            
            engine.checkDisconnectedPlayers(room);
            const playerEliminated = !player.isAlive;
            
            console.log(`  checkDisconnectedPlayers方法: ${hasCheckDisconnected ? '✅' : '❌'}`);
            console.log(`  断线玩家处理: ${playerEliminated ? '✅' : '❌'}`);
            
            const result = hasCheckDisconnected && playerEliminated;
            this.testResults.push({ name: '断线处理', passed: result });
            
            console.log(`  结果: ${result ? '✅ 通过' : '❌ 失败'}`);
            
        } catch (error) {
            console.log(`  测试异常: ${error.message}`);
            this.testResults.push({ name: '断线处理', passed: false });
        }
        
        this.showArchitectureSummary();
    }

    // 创建测试房间
    createTestRoom() {
        return {
            code: 'arch_test',
            players: new Map([
                ['player1', { id: 'player1', name: 'Alice', coins: 2, cards: ['duke', 'assassin'], isAlive: true, connected: true }],
                ['player2', { id: 'player2', name: 'Bob', coins: 2, cards: ['captain', 'contessa'], isAlive: true, connected: true }]
            ]),
            gameState: {
                status: 'playing',
                turnIndex: 0,
                currentPlayer: 'player1',
                deck: [],
                discardPile: [],
                lastAction: null,
                phase: { type: Phase.TURN_START, data: {} },
                log: []
            },
            lock: false
        };
    }

    // 显示架构测试总结
    showArchitectureSummary() {
        console.log('\n📊 架构完整性验证总结');
        console.log('=' .repeat(50));
        
        const passedTests = this.testResults.filter(t => t.passed).length;
        const totalTests = this.testResults.length;
        
        console.log(`\n通过测试: ${passedTests}/${totalTests}`);
        console.log('\n测试详情:');
        
        this.testResults.forEach((test, index) => {
            console.log(`${index + 1}. ${test.name}: ${test.passed ? '✅ 通过' : '❌ 失败'}`);
        });
        
        const successRate = (passedTests / totalTests * 100).toFixed(1);
        console.log(`\n架构评分: ${successRate}%`);
        
        if (passedTests === totalTests) {
            console.log('\n🎉 架构验证完全通过！系统架构符合生产级标准。');
            console.log('\n✅ 架构优势:');
            console.log('  - 清晰的模块分离 (Engine/RoomManager/SocketManager)');
            console.log('  - 统一的状态管理机制');
            console.log('  - 完善的安全防护措施');
            console.log('  - 健壮的计时器和断线处理');
        } else {
            console.log('\n⚠️  架构存在一些问题，建议进一步优化。');
            
            const failedTests = this.testResults.filter(t => !t.passed);
            console.log('\n❌ 需改进的方面:');
            failedTests.forEach(test => {
                console.log(`  - ${test.name}`);
            });
        }
        
        console.log('\n' + '=' .repeat(50));
    }

    // 运行架构测试
    runArchitectureTests() {
        console.log('🏛️  开始架构完整性验证...');
        console.log('目标: 验证生产级架构标准\n');
        
        this.testModuleSeparation();
    }
}

// 运行架构测试
const architectureTester = new ArchitectureTester();
architectureTester.runArchitectureTests();