// Chat Page - Real-time Chat with Socket.IO
import { useState, useEffect, useRef, useMemo } from "react";
import { useSocket } from "../hooks/useSocket";
import OnlineUsers from "../components/OnlineUsers";

function readCurrentUser() {
  try {
    const raw = localStorage.getItem("tavern_current_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function ChatPage() {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [currentUser, setCurrentUser] = useState(() => {
    const u = readCurrentUser();
    const fallback = localStorage.getItem("tavern_username") || "Guest";
    // normalize so we always have { username }
    return u ? { ...u, username: u?.name || u?.username || fallback } : { username: fallback };
  });

  const messagesEndRef = useRef(null);

  // ✅ username should reflect login changes (without refresh)
  const username = useMemo(() => {
    return currentUser?.username || localStorage.getItem("tavern_username") || "Guest";
  }, [currentUser]);

  // ✅ Pass username so the hook joins presence correctly
  const { isConnected, socket } = useSocket(username);

  // ✅ Keep current user synced when login/logout happens (same tab + other tabs)
  useEffect(() => {
    const syncAuth = () => {
      const u = readCurrentUser();
      const fallback = localStorage.getItem("tavern_username") || "Guest";
      setCurrentUser(
        u ? { ...u, username: u?.name || u?.username || fallback } : { username: fallback },
      );
    };

    window.addEventListener("storage", syncAuth);
    window.addEventListener("tavern:authChanged", syncAuth);

    return () => {
      window.removeEventListener("storage", syncAuth);
      window.removeEventListener("tavern:authChanged", syncAuth);
    };
  }, []);

  // ✅ Debug connection (remove later if you want)
  useEffect(() => {
    if (!socket) return;

    const onConnect = () => console.log("✅ socket connected:", socket.id);
    const onDisconnect = (reason) => console.log("⚠️ socket disconnected:", reason);
    const onConnectError = (err) => console.log("❌ connect_error:", err?.message, err);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
    };
  }, [socket]);

  // ✅ Listen for chat messages
  useEffect(() => {
    if (!socket) return;

    function onChatMessage(message) {
      setMessages((prev) => [...prev, message]);
    }

    socket.on("chat:message", onChatMessage);

    return () => {
      socket.off("chat:message", onChatMessage);
    };
  }, [socket]);

  // ✅ Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !isConnected || !socket) return;

    // ✅ send as object (preferred) but keep backward compatibility if server expects string
    socket.emit("chat:message", {
      message: newMessage.trim(),
      username: currentUser?.username || username,
    });

    setNewMessage("");
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        {/* Chat Area */}
        <div className="space-y-4">
          {/* Header */}
          <div className="relative overflow-hidden rounded-2xl border border-amber-900/30 bg-gradient-to-br from-slate-950 via-purple-950/40 to-slate-950 p-6 shadow-2xl shadow-purple-900/20">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">💬</span>
                <div>
                  <h1 className="font-serif text-2xl font-bold text-amber-100">
                    Tavern Chat
                  </h1>
                  <p className="font-serif text-sm italic text-amber-100/70">
                    Discuss trades, strategies, and connect with collectors
                  </p>
                  <p className="mt-1 font-serif text-xs text-amber-100/50">
                    Signed in as:{" "}
                    <span className="text-amber-300 font-semibold">
                      {currentUser?.username || "Guest"}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div
                  className={`h-3 w-3 rounded-full ${
                    isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
                  }`}
                />
                <span className="font-serif text-sm text-amber-100/70">
                  {isConnected ? "Connected" : "Disconnected"}
                </span>
              </div>
            </div>

            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
          </div>

          {/* Messages Area */}
          <div className="relative overflow-hidden rounded-2xl border border-amber-900/30 bg-gradient-to-br from-slate-950 to-purple-950/30 shadow-lg shadow-purple-900/20">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />

            {/* Messages Container */}
            <div className="h-[500px] overflow-y-auto p-6 space-y-4">
              {messages.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <p className="font-serif text-sm italic text-amber-100/50">
                    No messages yet. Start the conversation! ✨
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  // support both shapes: {username, message} OR {message, user} etc.
                  const msgUsername = msg?.username || msg?.user || "Unknown";
                  const msgText = msg?.message ?? msg?.text ?? "";
                  const msgTime = msg?.timestamp || msg?.created_at || Date.now();

                  const isOwnMessage = msgUsername === (currentUser?.username || username);

                  return (
                    <div
                      key={msg.id || `${msgUsername}-${msgTime}-${msgText.slice(0, 8)}`}
                      className={`flex ${
                        isOwnMessage ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg p-3 ${
                          isOwnMessage
                            ? "bg-gradient-to-r from-amber-950/50 to-purple-950/50 border border-amber-600/40"
                            : "bg-slate-950/70 border border-amber-900/20"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-serif text-xs font-semibold text-amber-400">
                            {msgUsername}
                          </span>
                          <span className="font-serif text-[10px] text-amber-100/40">
                            {formatTime(msgTime)}
                          </span>
                        </div>
                        <p className="font-serif text-sm text-amber-100/90">
                          {msgText}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="border-t border-amber-900/30 p-4">
              <form onSubmit={handleSendMessage} className="flex gap-3">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message..."
                  disabled={!isConnected}
                  className="flex-1 rounded-lg border border-amber-900/30 bg-slate-950 px-4 py-3 font-serif text-sm text-amber-100 placeholder-amber-100/40 focus:outline-none focus:ring-2 focus:ring-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!isConnected || !newMessage.trim()}
                  className="rounded-lg border border-amber-600/50 bg-gradient-to-r from-amber-950/50 to-purple-950/50 px-6 py-3 font-serif text-sm font-semibold text-amber-100 shadow-lg shadow-amber-900/30 transition-all hover:border-amber-500 hover:shadow-amber-500/40 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Send
                </button>
              </form>
            </div>

            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <OnlineUsers />
          {/* Chat Rules / Quick Tips unchanged */}
        </div>
      </div>
    </div>
  );
}

export default ChatPage;
