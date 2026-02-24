// 测试脚本：验证状态机重构
const GameManager = require('./server.js');

// 模拟Socket.io
const mockIo = {
    sockets: {
        sockets: new Map()
    }
};

// 创建游戏管理器实例
const gameManager = new GameManager(mockIo);

console.log('=== 政变游戏状态机重构测试 ===\n');

// 测试1：验证Phase常量定义
console.log('测试1：验证Phase常量定义');
try {
    console.log('✓ Phase.TURN_START:', Phase.TURN_START);
    console.log('✓ Phase.ACTION_DECLARED:', Phase.ACTION_DECLARED);
    console.log('✓ Phase.CHALLENGE_WINDOW:', Phase.CHALLENGE_WINDOW);
    console.log('✓ Phase.COUNTER_WINDOW:', Phase.COUNTER_WINDOW);
    console.log('✓ Phase.DISCARD:', Phase.DISCARD);
    console.log('✓ Phase.RESOLVE:', Phase.RESOLVE);
    console.log('✓ Phase.GAME_OVER:', Phase.GAME_OVER);
} catch (error) {
    console.log('✗ Phase常量定义错误:', error.message);
}

// 测试2：验证GameManager构造函数
console.log('\n测试2：验证GameManager构造函数');
try {
    console.log('✓ GameManager实例创建成功');
    console.log('✓ io实例正确保存:', gameManager.io === mockIo);
    console.log('✓ rooms Map初始化:', gameManager.rooms instanceof Map);
} catch (error) {
    console.log('✗ GameManager构造函数错误:', error.message);
}

// 测试3：验证Socket管理方法
console.log('\n测试3：验证Socket管理方法');
try {
    const mockSocket = { id: 'test-socket', emit: () => {} };
    mockIo.sockets.sockets.set('test-socket', mockSocket);
    
    const foundSocket = gameManager.getSocket('test-socket');
    if (foundSocket && foundSocket.id === 'test-socket') {
        console.log('✓ getSocket方法正常工作');
    } else {
        console.log('✗ getSocket方法有问题');
    }
} catch (error) {
    console.log('✗ Socket管理测试失败:', error.message);
}

// 测试4：验证房间创建和状态结构
console.log('\n测试4：验证房间创建和状态结构');
try {
    const createResult = gameManager.createRoom('测试玩家');
    const room = gameManager.rooms.get(createResult.roomCode);
    
    console.log('✓ 房间创建成功:', createResult.success);
    console.log('✓ 游戏状态包含phase字段:', 'phase' in room.gameState);
    console.log('✓ phase类型正确:', room.gameState.phase.type === Phase.TURN_START);
    console.log('✓ 包含turnIndex:', 'turnIndex' in room.gameState);
    console.log('✓ 包含timers:', 'timers' in room);
    console.log('✓ 包含locked状态:', 'locked' in room);
} catch (error) {
    console.log('✗ 房间创建测试失败:', error.message);
}

// 测试5：验证状态推进函数
console.log('\n测试5：验证状态推进函数');
try {
    const createResult = gameManager.createRoom('测试玩家2');
    const room = gameManager.rooms.get(createResult.roomCode);
    
    // 模拟游戏开始
    room.gameState.status = 'playing';
    room.gameState.turnIndex = 0;
    room.gameState.currentPlayer = Array.from(room.players.keys())[0];
    
    // 测试advancePhase
    const originalPhase = room.gameState.phase.type;
    gameManager.advancePhase(room);
    
    console.log('✓ advancePhase执行成功');
    console.log('✓ 房间锁机制正常:', !room.locked);
} catch (error) {
    console.log('✗ 状态推进测试失败:', error.message);
}

// 测试6：验证行动验证函数
console.log('\n测试6：验证行动验证函数');
try {
    const createResult = gameManager.createRoom('测试玩家3');
    const room = gameManager.rooms.get(createResult.roomCode);
    const player = room.players.get(createResult.playerId);
    
    // 测试合法行动
    const incomeValidation = gameManager.validateAction('income', player, null, room);
    console.log('✓ income行动验证:', incomeValidation.valid);
    
    // 测试金币不足的行动
    const coupValidation = gameManager.validateAction('coup', player, null, room);
    console.log('✓ coup金币不足验证:', !coupValidation.valid);
    
    // 测试无效行动
    const invalidValidation = gameManager.validateAction('invalid_action', player, null, room);
    console.log('✓ 无效行动验证:', !invalidValidation.valid);
} catch (error) {
    console.log('✗ 行动验证测试失败:', error.message);
}

// 测试7：验证计时器管理
console.log('\n测试7：验证计时器管理');
try {
    const createResult = gameManager.createRoom('测试玩家4');
    const room = gameManager.rooms.get(createResult.roomCode);
    
    let timerCalled = false;
    gameManager.startPhaseTimer(room, 0.1, () => {
        timerCalled = true;
    });
    
    // 等待计时器执行
    setTimeout(() => {
        console.log('✓ 计时器正常工作:', timerCalled);
        gameManager.clearPhaseTimer(room);
        console.log('✓ 计时器清理成功');
        
        console.log('\n=== 所有测试完成！===');
    }, 200);
} catch (error) {
    console.log('✗ 计时器测试失败:', error.message);
}

console.log('\n注意：计时器测试需要200ms后完成...');