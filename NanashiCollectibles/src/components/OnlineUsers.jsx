// Online Users Component - Shows who's currently online
import { useMemo, useEffect, useState } from "react";
import { useSocket } from "../hooks/useSocket";

function readCurrentUser() {
  try {
    const raw = localStorage.getItem("tavern_current_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function OnlineUsers() {
  // ✅ keep a local username that updates after login/logout (no refresh)
  const [username, setUsername] = useState(() => {
    const u = readCurrentUser();
    return u?.name || localStorage.getItem("tavern_username") || "Guest";
  });

  // ✅ sync username when auth changes
  useEffect(() => {
    const syncAuth = () => {
      const u = readCurrentUser();
      setUsername(u?.name || localStorage.getItem("tavern_username") || "Guest");
    };

    window.addEventListener("storage", syncAuth);
    window.addEventListener("tavern:authChanged", syncAuth);

    return () => {
      window.removeEventListener("storage", syncAuth);
      window.removeEventListener("tavern:authChanged", syncAuth);
    };
  }, []);

  // ✅ IMPORTANT: pass username so this component joins presence correctly too
  const { onlineUsers, isConnected } = useSocket(username);

  // ✅ Safety: ensure array
  const users = useMemo(() => (Array.isArray(onlineUsers) ? onlineUsers : []), [onlineUsers]);

  // ✅ Optional: de-duplicate by username (or socketId)
  const uniqueUsers = useMemo(() => {
    const seen = new Set();
    return users.filter((u) => {
      const key = u?.username || u?.socketId;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [users]);

  return (
    <div className="relative overflow-hidden rounded-xl border border-amber-900/30 bg-gradient-to-br from-slate-950 to-purple-950/30 p-4 shadow-lg shadow-purple-900/20">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />

      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-serif text-sm font-bold text-amber-100">
          👥 Online Users
        </h3>

        <span className="font-serif text-xs text-amber-400">
          {uniqueUsers.length} online
        </span>
      </div>

      {/* ✅ shows who YOU are */}
      <div className="mb-3 rounded-lg border border-amber-900/20 bg-slate-950/40 px-3 py-2">
        <p className="font-serif text-[11px] text-amber-100/60">
          You are:{" "}
          <span className="text-amber-300 font-semibold">{username}</span>
        </p>
      </div>

      {uniqueUsers.length === 0 ? (
        <p className="py-4 text-center font-serif text-xs italic text-amber-100/50">
          {isConnected ? "No users online yet" : "Disconnected from server"}
        </p>
      ) : (
        <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
          {uniqueUsers.map((user) => {
            const isMe = (user?.username || "").toLowerCase() === username.toLowerCase();
            return (
              <div
                key={user.socketId || user.username}
                className={`flex items-center gap-2 rounded-lg border p-2 ${
                  isMe
                    ? "border-amber-600/40 bg-amber-950/20"
                    : "border-amber-900/20 bg-slate-950/50"
                }`}
              >
                <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                <span className="font-serif text-xs text-amber-100">
                  {user.username}
                  {isMe ? " (you)" : ""}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
    </div>
  );
}

export default OnlineUsers;
