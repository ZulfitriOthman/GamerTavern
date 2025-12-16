// Socket.IO Server for GamerTavern
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
const httpServer = createServer(app);

// Environment variables
const PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Configure CORS
app.use(cors({
  origin: CLIENT_URL,
  credentials: true
}));

// Initialize Socket.IO with CORS
const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Store online users
const onlineUsers = new Map();
// Store active trades
const activeTrades = new Map();
// Store recent activities
const recentActivities = [];

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('✅ User connected:', socket.id);

  // User joins with username
  socket.on('user:join', (username) => {
    onlineUsers.set(socket.id, { username, socketId: socket.id });
    
    // Broadcast updated user list
    io.emit('users:online', Array.from(onlineUsers.values()));
    
    // Notify others
    socket.broadcast.emit('user:joined', { username });
    
    console.log(`👤 ${username} joined (${onlineUsers.size} users online)`);
  });

  // New product added to shop
  socket.on('product:new', (product) => {
    // Broadcast to all clients
    io.emit('product:added', product);
    
    // Add to recent activities
    const activity = {
      id: Date.now(),
      type: 'product',
      message: `New ${product.name} added to shop!`,
      timestamp: new Date().toISOString()
    };
    recentActivities.unshift(activity);
    if (recentActivities.length > 20) recentActivities.pop();
    
    io.emit('activity:new', activity);
    console.log('📦 New product broadcasted:', product.name);
  });

  // Someone added item to cart
  socket.on('cart:add', (data) => {
    const user = onlineUsers.get(socket.id);
    const activity = {
      id: Date.now(),
      type: 'cart',
      message: `${user?.username || 'Someone'} added ${data.productName} to cart`,
      timestamp: new Date().toISOString()
    };
    recentActivities.unshift(activity);
    if (recentActivities.length > 20) recentActivities.pop();
    
    // Broadcast to all users
    io.emit('activity:new', activity);
  });

  // Trade offer created
  socket.on('trade:create', (tradeData) => {
    const tradeId = `trade-${Date.now()}`;
    const trade = {
      id: tradeId,
      ...tradeData,
      createdAt: new Date().toISOString(),
      status: 'pending'
    };
    
    activeTrades.set(tradeId, trade);
    
    // Broadcast new trade to all users
    io.emit('trade:new', trade);
    
    const user = onlineUsers.get(socket.id);
    const activity = {
      id: Date.now(),
      type: 'trade',
      message: `${user?.username || 'Someone'} created a new trade offer`,
      timestamp: new Date().toISOString()
    };
    recentActivities.unshift(activity);
    io.emit('activity:new', activity);
    
    console.log('🔄 New trade created:', tradeId);
  });

  // Trade offer accepted
  socket.on('trade:accept', (tradeId) => {
    const trade = activeTrades.get(tradeId);
    if (trade) {
      trade.status = 'accepted';
      io.emit('trade:updated', trade);
      
      const activity = {
        id: Date.now(),
        type: 'trade',
        message: `Trade offer accepted!`,
        timestamp: new Date().toISOString()
      };
      recentActivities.unshift(activity);
      io.emit('activity:new', activity);
    }
  });

  // Chat message
  socket.on('chat:message', (message) => {
    const user = onlineUsers.get(socket.id);
    const chatMessage = {
      id: Date.now(),
      username: user?.username || 'Anonymous',
      message: message,
      timestamp: new Date().toISOString()
    };
    
    // Broadcast to all users
    io.emit('chat:message', chatMessage);
    console.log(`💬 ${chatMessage.username}: ${message}`);
  });

  // Stock update notification
  socket.on('stock:update', (stockData) => {
    // Broadcast stock changes
    io.emit('stock:changed', stockData);
    
    if (stockData.stock === 0) {
      const activity = {
        id: Date.now(),
        type: 'stock',
        message: `${stockData.productName} is now OUT OF STOCK!`,
        timestamp: new Date().toISOString()
      };
      recentActivities.unshift(activity);
      io.emit('activity:new', activity);
    }
  });

  // Price update notification
  socket.on('price:update', (priceData) => {
    io.emit('price:changed', priceData);
    
    const activity = {
      id: Date.now(),
      type: 'price',
      message: `Price updated: ${priceData.productName} now BND ${priceData.newPrice}`,
      timestamp: new Date().toISOString()
    };
    recentActivities.unshift(activity);
    io.emit('activity:new', activity);
  });

  // Send recent activities to new user
  socket.on('activities:request', () => {
    socket.emit('activities:list', recentActivities);
  });

  // Send all trades to new user
  socket.on('trades:request', () => {
    socket.emit('trades:list', Array.from(activeTrades.values()));
  });

  // Disconnect handling
  socket.on('disconnect', () => {
    const user = onlineUsers.get(socket.id);
    onlineUsers.delete(socket.id);
    
    // Broadcast updated user list
    io.emit('users:online', Array.from(onlineUsers.values()));
    
    if (user) {
      socket.broadcast.emit('user:left', { username: user.username });
      console.log(`👋 ${user.username} left (${onlineUsers.size} users online)`);
    }
    
    console.log('❌ User disconnected:', socket.id);
  });
});

// REST API endpoints
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    onlineUsers: onlineUsers.size,
    activeTrades: activeTrades.size,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/stats', (req, res) => {
  res.json({
    onlineUsers: onlineUsers.size,
    users: Array.from(onlineUsers.values()),
    activeTrades: activeTrades.size,
    recentActivities: recentActivities.slice(0, 10)
  });
});

// Start server
httpServer.listen(PORT, () => {
  console.log('\n' + '='.repeat(50));
  console.log('🎮 GamerTavern Socket.IO Server Started!');
  console.log('='.repeat(50));
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 WebSocket ready for connections`);
  console.log(`🌐 CORS enabled for ${CLIENT_URL}`);
  console.log('='.repeat(50) + '\n');
});
