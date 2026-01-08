# Nanashi Collectibles

A real-time trading card game (TCG) collectibles platform with live activity feed, chat, trading, and shopping features.

## 🚀 Features

- 🛒 **Shop** - Browse and purchase collectibles
- 💬 **Live Chat** - Real-time chat with other collectors
- 🔄 **Trading System** - Create and accept trade offers
- 📊 **Live Activity Feed** - See what's happening in real-time
- 👥 **Online Users** - Track who's currently online
- 📰 **News** - Stay updated with latest announcements

## 🏗️ Architecture

This project consists of two connected applications:

### 1. NanashiCollectibles (Customer Site)
- Customer-facing e-commerce platform
- Real-time features via Socket.IO
- Port: `5173` (Vite dev server)

### 2. Tavern Merchant Portal
- Merchant admin panel (located in `../tavern-merchant/`)
- Product & order management
- Real-time sync with customer site
- Port: `5174` (Vite dev server)

### 3. Shared Backend Server
- Express + Socket.IO server
- Handles both customer and merchant requests
- Port: `3001`
- Real-time broadcasting to all connected clients

## 📦 Installation

```bash
# Install dependencies
npm install

# Install merchant portal dependencies (optional)
cd ../tavern-merchant
npm install
cd ../NanashiCollectibles
```

## 🔧 Development

### Start Everything (Recommended)

```bash
# Start both frontend and server together
npm run dev:all
```

This runs:
- Vite dev server (customer site) on `http://localhost:5173`
- Socket.IO server on `http://localhost:3001`

### Start Individually

```bash
# Frontend only
npm run dev

# Server only  
npm run server

# Production server
npm run server:prod
```

### Start Merchant Portal

```bash
# In a new terminal
cd ../tavern-merchant
npm run dev
```

Merchant portal will run on `http://localhost:5174`

## 🔑 Demo Credentials

**Merchant Login:**
- Email: `merchant@nanashi.com`
- Password: `merchant123`

## 🛠️ Tech Stack

### Frontend
- React 19
- React Router DOM
- Tailwind CSS
- Socket.IO Client
- Lightweight Charts

### Backend
- Express 5
- Socket.IO 4
- CORS

### Dev Tools
- Vite (Rolldown)
- ESLint
- Nodemon
- Concurrently

## 📡 API Endpoints

### Customer Endpoints
- `GET /` - Health check
- `GET /api/health` - Server status
- `GET /api/stats` - Online users & activity stats

### Merchant Endpoints
- `POST /api/auth/login` - Merchant login
- `GET /api/merchant/products` - List products
- `POST /api/merchant/products` - Create/update product
- `PATCH /api/merchant/products/:id` - Update product
- `DELETE /api/merchant/products/:id` - Delete product
- `GET /api/merchant/orders` - List orders
- `PATCH /api/merchant/orders/:id` - Update order status

## 🔌 Socket.IO Events

### Client → Server
- `user:join` - Join with username
- `chat:message` - Send chat message
- `product:new` - Add new product
- `cart:add` - Add to cart
- `trade:create` - Create trade offer
- `trade:accept` - Accept trade
- `stock:update` - Update stock
- `price:update` - Update price
- `activities:request` - Request activity list
- `trades:request` - Request trade list

### Server → Client
- `users:online` - Online users list
- `user:joined` - User joined notification
- `user:left` - User left notification
- `chat:message` - New chat message
- `product:added` - New product added
- `product:removed` - Product removed
- `stock:changed` - Stock updated
- `price:changed` - Price updated
- `trade:new` - New trade created
- `trade:updated` - Trade status updated
- `order:updated` - Order status updated
- `activity:new` - New activity
- `activities:list` - Activity feed
- `trades:list` - Active trades

## 📝 Environment Variables

Create a `.env` file in the server directory if needed:

```env
PORT=3001
CLIENT_URL=http://localhost:5173
EXTRA_ORIGINS=http://localhost:5174
```

## 🚀 Deployment

The server is configured for deployment on platforms like Render, Railway, or Cloudflare:

```bash
npm run server:prod
```

Set these environment variables in production:
- `PORT` - Server port
- `CLIENT_URL` - Your production frontend URL
- `EXTRA_ORIGINS` - Comma-separated additional allowed origins

## 📄 License

Private project for Nanashi Collectibles

## 🔗 Related Projects

- [Tavern Merchant Portal](../tavern-merchant/) - Admin panel for merchants
