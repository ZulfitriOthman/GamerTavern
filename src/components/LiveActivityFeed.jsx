// Live Activity Feed Component - Shows real-time activities
import { useEffect, useState } from 'react';
import { socket } from '../socket/socketClient';

function LiveActivityFeed() {
  const [activities, setActivities] = useState([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Socket event handlers
    function onConnect() {
      setIsConnected(true);
      socket.emit('activities:request');
    }

    function onDisconnect() {
      setIsConnected(false);
    }

    function onActivityNew(activity) {
      setActivities((prev) => [activity, ...prev].slice(0, 10));
    }

    function onActivitiesList(activityList) {
      setActivities(activityList.slice(0, 10));
    }

    // Register listeners
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('activity:new', onActivityNew);
    socket.on('activities:list', onActivitiesList);

    // Check if already connected
    if (socket.connected) {
      setIsConnected(true);
      socket.emit('activities:request');
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('activity:new', onActivityNew);
      socket.off('activities:list', onActivitiesList);
    };
  }, []);

  // Activity type icons
  const getActivityIcon = (type) => {
    switch (type) {
      case 'product': return '📦';
      case 'cart': return '🛒';
      case 'trade': return '🔄';
      case 'stock': return '⚠️';
      case 'price': return '💰';
      default: return '✨';
    }
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  if (activities.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-amber-900/30 bg-gradient-to-br from-slate-950 to-purple-950/30 p-4 shadow-lg shadow-purple-900/20">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
        
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-serif text-sm font-bold text-amber-100">
            🔴 Live Activity
          </h3>
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="font-serif text-xs text-amber-100/60">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>

        <p className="font-serif text-xs italic text-amber-100/50 text-center py-4">
          No recent activity. Waiting for updates...
        </p>

        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-amber-900/30 bg-gradient-to-br from-slate-950 to-purple-950/30 p-4 shadow-lg shadow-purple-900/20">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
      
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-serif text-sm font-bold text-amber-100">
          🔴 Live Activity
        </h3>
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="font-serif text-xs text-amber-100/60">
            {isConnected ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>

      <div className="space-y-2 max-h-80 overflow-y-auto">
        {activities.map((activity) => (
          <div
            key={activity.id}
            className="flex items-start gap-2 rounded-lg border border-amber-900/20 bg-slate-950/50 p-2 transition-all hover:border-amber-600/30"
          >
            <span className="text-lg">{getActivityIcon(activity.type)}</span>
            <div className="flex-1 min-w-0">
              <p className="font-serif text-xs text-amber-100/80 line-clamp-2">
                {activity.message}
              </p>
              <span className="font-serif text-[10px] italic text-amber-100/40">
                {formatTime(activity.timestamp)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
    </div>
  );
}

export default LiveActivityFeed;
