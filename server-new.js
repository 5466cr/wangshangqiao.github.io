const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const SocketManager = require('./socket/SocketManager');
const RoomManager = require('./room/RoomManager');

// 创建Express应用
const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

// 创建HTTP服务器
const server = http.createServer(app);

// 创建Socket.io服务器
const io = new Server(server, {
    cors: { origin: '*' },
    pingInterval: 25000,
    pingTimeout: 5000,
    maxHttpBufferSize: 1e6
});

// 创建管理器实例
const roomManager = new RoomManager();
const socketManager = new SocketManager(io);

// API路由
app.get('/api/health', (req, res) => {
    const stats = roomManager.getRoomStats();
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        stats
    });
});

app.get('/api/stats', (req, res) => {
    const stats = roomManager.getRoomStats();
    res.json(stats);
});

app.get('/api/rooms', (req, res) => {
    const rooms = roomManager.getAllRooms().map(room => ({
        code: room.code,
        playerCount: room.players.size,
        status: room.gameState.status,
        createdAt: room.createdAt
    }));
    res.json(rooms);
});

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error('API错误:', err);
    res.status(500).json({ error: '内部服务器错误' });
});

// Socket.io错误处理
io.on('connection_error', (err) => {
    console.error('Socket连接错误:', err.message);
});

// 启动服务器
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`政变游戏服务器启动在端口 ${PORT}`);
    console.log(`健康检查: http://localhost:${PORT}/api/health`);
    console.log(`统计信息: http://localhost:${PORT}/api/stats`);
});

// 优雅关闭
process.on('SIGINT', () => {
    console.log('正在关闭服务器...');
    
    // 停止房间清理任务
    roomManager.stopCleanupInterval();
    
    // 关闭所有连接
    io.close(() => {
        console.log('Socket.io服务器已关闭');
        server.close(() => {
            console.log('HTTP服务器已关闭');
            process.exit(0);
        });
    });
});

// 未捕获异常处理
process.on('uncaughtException', (err) => {
    console.error('未捕获异常:', err);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('未处理的Promise拒绝:', reason);
});

console.log('政变游戏服务器初始化完成');