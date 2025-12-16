// Online Users Component - Shows who's currently online
import { useEffect, useState } from 'react';
import { socket } from '../socket/socketClient';

function OnlineUsers() {
  const [users, setUsers] = useState([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    function onConnect() {
      setIsConnected(true);
    }

    function onDisconnect() {
      setIsConnected(false);
      setUsers([]);
    }

    function onUsersOnline(userList) {
      setUsers(userList);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('users:online', onUsersOnline);

    if (socket.connected) {
      setIsConnected(true);
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('users:online', onUsersOnline);
    };
  }, []);

  return (
    <div className="relative overflow-hidden rounded-xl border border-amber-900/30 bg-gradient-to-br from-slate-950 to-purple-950/30 p-4 shadow-lg shadow-purple-900/20">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
      
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-serif text-sm font-bold text-amber-100">
          👥 Online Users
        </h3>
        <span className="font-serif text-xs text-amber-400">
          {users.length} online
        </span>
      </div>

      {users.length === 0 ? (
        <p className="font-serif text-xs italic text-amber-100/50 text-center py-4">
          {isConnected ? 'No users online yet' : 'Disconnected from server'}
        </p>
      ) : (
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {users.map((user) => (
            <div
              key={user.socketId}
              className="flex items-center gap-2 rounded-lg border border-amber-900/20 bg-slate-950/50 p-2"
            >
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="font-serif text-xs text-amber-100">
                {user.username}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
    </div>
  );
}

export default OnlineUsers;
