// 测试挑战成功后的换牌逻辑
const { GameManager } = require('./server.js');

// 创建游戏管理器实例
const gameManager = new GameManager();

// 模拟游戏房间
const mockRoom = {
    roomCode: 'TEST',
    status: 'playing',
    players: new Map([
        ['player1', {
            id: 'player1',
            name: 'Alice',
            isAlive: true,
            cards: ['duke', 'captain'],
            coins: 5
        }]
    ]),
    gameState: {
        deck: ['ambassador', 'assassin', 'contessa'],
        discardPile: []
    }
};

// 模拟洗牌函数
gameManager.shuffleDeck = (deck) => {
    // 简单的洗牌算法
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
};

console.log('=== 测试挑战成功后的换牌逻辑 ===\n');

// 测试前的状态
console.log('测试前:');
console.log('- 玩家卡牌:', mockRoom.players.get('player1').cards);
console.log('- 牌堆:', mockRoom.gameState.deck);
console.log('- 弃牌堆:', mockRoom.gameState.discardPile);

// 执行换牌
console.log('\n执行换牌...');
const swapResult = gameManager.swapCard(mockRoom, 'player1', 'duke');

// 测试后的状态
console.log('\n测试后:');
console.log('- 玩家卡牌:', mockRoom.players.get('player1').cards);
console.log('- 牌堆:', mockRoom.gameState.deck);
console.log('- 弃牌堆:', mockRoom.gameState.discardPile);

// 验证结果
console.log('\n=== 验证结果 ===');
console.log('- 交换的卡牌:', swapResult);
console.log('- 原卡牌是否在牌堆中:', mockRoom.gameState.deck.includes('duke'));
console.log('- 玩家手牌数量是否正确:', mockRoom.players.get('player1').cards.length === 2);
console.log('- 新卡牌是否来自牌堆:', !mockRoom.gameState.deck.includes(swapResult.newCard));

console.log('\n=== 测试完成 ===');