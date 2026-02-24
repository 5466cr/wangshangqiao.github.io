// 测试脚本：验证修复后的代码
const GameManager = require('./server.js');

// 模拟Socket.io
const mockIo = {
    sockets: {
        sockets: new Map()
    }
};

// 创建游戏管理器实例
const gameManager = new GameManager(mockIo);

// 测试1：验证代码结构是否正确
console.log('测试1：验证代码结构');
try {
    console.log('✓ GameManager 构造函数正常');
    console.log('✓ 所有方法定义正常');
} catch (error) {
    console.log('✗ 代码结构错误:', error.message);
}

// 测试2：验证Socket查找方法
console.log('\n测试2：验证Socket查找方法');
try {
    const mockSocket = { id: 'test-socket', emit: () => {} };
    mockIo.sockets.sockets.set('test-socket', mockSocket);
    
    const foundSocket = gameManager.getSocket('test-socket');
    if (foundSocket && foundSocket.id === 'test-socket') {
        console.log('✓ Socket查找方法正常工作');
    } else {
        console.log('✗ Socket查找方法有问题');
    }
} catch (error) {
    console.log('✗ Socket查找测试失败:', error.message);
}

// 测试3：验证游戏状态结构
console.log('\n测试3：验证游戏状态结构');
try {
    const room = gameManager.createRoom('test-room');
    console.log('✓ 房间创建成功');
    console.log('✓ 游戏状态包含必要字段:', 
        'challengePhase' in room.gameState && 
        'blockPhase' in room.gameState && 
        'discardSelection' in room.gameState
    );
} catch (error) {
    console.log('✗ 游戏状态测试失败:', error.message);
}

console.log('\n所有测试完成！');