// Online Users Component - Shows who's currently online
import { useMemo } from "react";
import { useSocket } from "../hooks/useSocket";

function OnlineUsers() {
  const { onlineUsers, isConnected } = useSocket();

  // Safety: ensure array
  const users = useMemo(() => onlineUsers || [], [onlineUsers]);

  return (
    <div className="relative overflow-hidden rounded-xl border border-amber-900/30 bg-gradient-to-br from-slate-950 to-purple-950/30 p-4 shadow-lg shadow-purple-900/20">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />

      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-serif text-sm font-bold text-amber-100">
          👥 Online Users
        </h3>

        <span className="font-serif text-xs text-amber-400">
          {users.length} online
        </span>
      </div>

      {users.length === 0 ? (
        <p className="py-4 text-center font-serif text-xs italic text-amber-100/50">
          {isConnected ? "No users online yet" : "Disconnected from server"}
        </p>
      ) : (
        <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
          {users.map((user) => (
            <div
              key={user.socketId}
              className="flex items-center gap-2 rounded-lg border border-amber-900/20 bg-slate-950/50 p-2"
            >
              <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
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
