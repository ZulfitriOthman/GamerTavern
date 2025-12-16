// Socket.IO Demo Page - Test real-time features
import { useState } from 'react';
import { useSocket } from '../hooks/useSocket';
import LiveActivityFeed from '../components/LiveActivityFeed';
import OnlineUsers from '../components/OnlineUsers';

function SocketDemo() {
  const [message, setMessage] = useState('');
  const [testProduct, setTestProduct] = useState('Rare Card');
  
  const { 
    isConnected, 
    onlineUsers, 
    activities,
    emitChatMessage,
    emitProductNew,
    emitCartAdd 
  } = useSocket();

  const handleSendMessage = () => {
    if (message.trim()) {
      emitChatMessage(message);
      setMessage('');
    }
  };

  const handleAddProduct = () => {
    emitProductNew({
      id: Date.now(),
      name: testProduct,
      price: Math.random() * 100 + 10,
      tcg: 'mtg'
    });
  };

  const handleAddToCart = () => {
    emitCartAdd(testProduct);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-900/30 bg-gradient-to-br from-slate-950 via-purple-950/40 to-slate-950 p-8 shadow-2xl shadow-purple-900/20">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
        
        <h1 className="font-serif text-4xl font-bold text-amber-100">
          🔴 Socket.IO Demo
        </h1>
        <p className="mt-2 font-serif text-sm italic text-amber-100/70">
          Test real-time features and see events in action
        </p>
        
        {/* Connection Status */}
        <div className="mt-4 flex items-center gap-3">
          <div className={`h-3 w-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="font-serif text-sm text-amber-100">
            {isConnected ? '✅ Connected to Socket.IO Server' : '❌ Disconnected'}
          </span>
        </div>
        
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column - Controls */}
        <div className="space-y-6">
          {/* Chat Test */}
          <div className="relative overflow-hidden rounded-xl border border-amber-900/30 bg-gradient-to-br from-slate-950 to-purple-950/30 p-6 shadow-lg shadow-purple-900/20">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
            
            <h3 className="font-serif text-lg font-bold text-amber-100 mb-4">
              💬 Send Chat Message
            </h3>
            
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Type a message..."
              className="w-full rounded-lg border border-amber-900/30 bg-slate-950 px-4 py-3 font-serif text-sm text-amber-100 placeholder-amber-100/40 focus:outline-none focus:ring-2 focus:ring-amber-600"
            />
            
            <button
              onClick={handleSendMessage}
              disabled={!isConnected || !message.trim()}
              className="mt-3 w-full rounded-lg border border-amber-600/50 bg-gradient-to-r from-amber-950/50 to-purple-950/50 py-3 font-serif text-sm font-semibold text-amber-100 shadow-lg shadow-amber-900/30 transition-all hover:border-amber-500 hover:shadow-amber-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send Message
            </button>
            
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
          </div>

          {/* Product Test */}
          <div className="relative overflow-hidden rounded-xl border border-amber-900/30 bg-gradient-to-br from-slate-950 to-purple-950/30 p-6 shadow-lg shadow-purple-900/20">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
            
            <h3 className="font-serif text-lg font-bold text-amber-100 mb-4">
              📦 Test Product Events
            </h3>
            
            <input
              type="text"
              value={testProduct}
              onChange={(e) => setTestProduct(e.target.value)}
              placeholder="Product name..."
              className="w-full rounded-lg border border-amber-900/30 bg-slate-950 px-4 py-3 font-serif text-sm text-amber-100 placeholder-amber-100/40 focus:outline-none focus:ring-2 focus:ring-amber-600"
            />
            
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button
                onClick={handleAddProduct}
                disabled={!isConnected}
                className="rounded-lg border border-amber-600/50 bg-gradient-to-r from-amber-950/50 to-purple-950/50 py-3 font-serif text-sm font-semibold text-amber-100 shadow-lg shadow-amber-900/30 transition-all hover:border-amber-500 hover:shadow-amber-500/40 disabled:opacity-50"
              >
                Add Product
              </button>
              
              <button
                onClick={handleAddToCart}
                disabled={!isConnected}
                className="rounded-lg border border-purple-600/50 bg-gradient-to-r from-purple-950/50 to-amber-950/50 py-3 font-serif text-sm font-semibold text-amber-100 shadow-lg shadow-purple-900/30 transition-all hover:border-purple-500 hover:shadow-purple-500/40 disabled:opacity-50"
              >
                Add to Cart
              </button>
            </div>
            
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
          </div>

          {/* Online Users */}
          <OnlineUsers />
        </div>

        {/* Right Column - Activity Feed */}
        <div className="space-y-6">
          <LiveActivityFeed />
          
          {/* Stats */}
          <div className="relative overflow-hidden rounded-xl border border-amber-900/30 bg-gradient-to-br from-slate-950 to-purple-950/30 p-6 shadow-lg shadow-purple-900/20">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
            
            <h3 className="font-serif text-lg font-bold text-amber-100 mb-4">
              📊 Real-time Stats
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-amber-900/20 bg-slate-950/50 p-4">
                <p className="font-serif text-xs text-amber-100/60">Online Users</p>
                <p className="mt-1 font-serif text-2xl font-bold text-amber-400">
                  {onlineUsers.length}
                </p>
              </div>
              
              <div className="rounded-lg border border-amber-900/20 bg-slate-950/50 p-4">
                <p className="font-serif text-xs text-amber-100/60">Activities</p>
                <p className="mt-1 font-serif text-2xl font-bold text-amber-400">
                  {activities.length}
                </p>
              </div>
            </div>
            
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
          </div>

          {/* Instructions */}
          <div className="relative overflow-hidden rounded-xl border border-amber-900/30 bg-gradient-to-br from-slate-950 to-purple-950/30 p-6 shadow-lg shadow-purple-900/20">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
            
            <h3 className="font-serif text-lg font-bold text-amber-100 mb-3">
              💡 Try This
            </h3>
            
            <ul className="space-y-2 font-serif text-sm text-amber-100/80">
              <li className="flex items-start gap-2">
                <span>1.</span>
                <span>Open this page in multiple browser tabs</span>
              </li>
              <li className="flex items-start gap-2">
                <span>2.</span>
                <span>Send messages or add products in one tab</span>
              </li>
              <li className="flex items-start gap-2">
                <span>3.</span>
                <span>Watch activities appear in all tabs instantly!</span>
              </li>
              <li className="flex items-start gap-2">
                <span>4.</span>
                <span>See online user count update in real-time</span>
              </li>
            </ul>
            
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default SocketDemo;
