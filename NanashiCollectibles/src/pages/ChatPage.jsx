// Chat Page - Real-time Chat with Socket.IO
import { useState, useEffect, useRef, useMemo } from "react";
import { useSocket } from "../hooks/useSocket";
import OnlineUsers from "../components/OnlineUsers";
import { getCurrentUser, getUsername } from "../authStorage";

function readCurrentUser() {
  return getCurrentUser();
}

function ChatPage() {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [connectionError, setConnectionError] = useState(null);
  const [currentUser, setCurrentUser] = useState(() => {
    const u = readCurrentUser();
    const fallback = getUsername("Guest") || "Guest";
    // normalize so we always have { username }
    return u ? { ...u, username: u?.name || u?.username || fallback } : { username: fallback };
  });

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const inputRef = useRef(null);

  // ✅ username should reflect login changes (without refresh)
  const username = useMemo(() => {
    return currentUser?.username || getUsername("Guest") || "Guest";
  }, [currentUser]);

  // ✅ Pass username so the hook joins presence correctly
  const { isConnected, socket } = useSocket(username);

  // ✅ Keep current user synced when login/logout happens (same tab + other tabs)
  useEffect(() => {
    const syncAuth = () => {
      const u = readCurrentUser();
      const fallback = getUsername("Guest") || "Guest";
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

  // Enhanced connection handling
  useEffect(() => {
    if (!socket) return;

    const onConnect = () => {
      console.log("✅ socket connected:", socket.id);
      setConnectionError(null);
    };
    const onDisconnect = (reason) => {
      console.log("⚠️ socket disconnected:", reason);
      setConnectionError(`Disconnected: ${reason}`);
    };
    const onConnectError = (err) => {
      console.log("❌ connect_error:", err?.message, err);
      setConnectionError("Connection failed");
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
    };
  }, [socket]);

  // ✅ Listen for chat messages and typing
  useEffect(() => {
    if (!socket) return;

    function onChatMessage(message) {
      console.log("📨 Received:", message);
      setMessages((prev) => {
        // Prevent duplicates
        if (prev.some(m => m.id === message.id)) return prev;
        return [...prev, message];
      });
      // Clear typing for this user
      setTypingUsers(prev => {
        const next = new Set(prev);
        next.delete(message.username);
        return next;
      });
    }

    function onUserTyping({ username: typingUser }) {
      if (typingUser !== username) {
        setTypingUsers(prev => new Set(prev).add(typingUser));
        setTimeout(() => setTypingUsers(prev => {
          const next = new Set(prev);
          next.delete(typingUser);
          return next;
        }), 3000);
      }
    }

    socket.on("chat:message", onChatMessage);
    socket.on("chat:typing", onUserTyping);

    return () => {
      socket.off("chat:message", onChatMessage);
      socket.off("chat:typing", onUserTyping);
    };
  }, [socket, username]);

  // ✅ Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle typing indicator
  const handleTyping = () => {
    if (!socket || !isConnected) return;
    if (!isTyping) {
      setIsTyping(true);
      socket.emit("chat:typing", { username });
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 1000);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !isConnected || !socket) return;

    console.log("📤 Sending:", newMessage.trim());
    // Backend expects STRING
    socket.emit("chat:message", newMessage.trim());

    setNewMessage("");
    setIsTyping(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    inputRef.current?.focus();
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

              <div className="flex flex-col items-end gap-1">
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
                {connectionError && (
                  <span className="font-serif text-xs text-red-400">
                    {connectionError}
                  </span>
                )}
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
              
              {/* Typing Indicator */}
              {typingUsers.size > 0 && (
                <div className="flex items-center gap-2 px-3 py-2">
                  <div className="flex gap-1">
                    <div className="h-2 w-2 animate-bounce rounded-full bg-amber-500/50"></div>
                    <div className="h-2 w-2 animate-bounce rounded-full bg-amber-500/50" style={{ animationDelay: "150ms" }}></div>
                    <div className="h-2 w-2 animate-bounce rounded-full bg-amber-500/50" style={{ animationDelay: "300ms" }}></div>
                  </div>
                  <span className="font-serif text-xs italic text-amber-100/50">
                    {Array.from(typingUsers).join(", ")} {typingUsers.size === 1 ? "is" : "are"} typing...
                  </span>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="border-t border-amber-900/30 bg-slate-950/50 p-4">
              <form onSubmit={handleSendMessage} className="flex gap-3">
                <div className="relative flex-1">
                  <input
                    ref={inputRef}
                    type="text"
                    value={newMessage}
                    onChange={(e) => {
                      setNewMessage(e.target.value);
                      handleTyping();
                    }}
                    placeholder={isConnected ? "Type your message..." : "Connecting..."}
                    disabled={!isConnected}
                    maxLength={500}
                    className="w-full rounded-lg border border-amber-900/30 bg-slate-950 px-4 py-3 pr-12 font-serif text-sm text-amber-100 placeholder-amber-100/40 transition-all focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-600/30 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  {newMessage && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 font-serif text-xs text-amber-100/30">
                      {newMessage.length}/500
                    </span>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={!isConnected || !newMessage.trim()}
                  className="group rounded-lg border border-amber-600/50 bg-gradient-to-r from-amber-950/50 to-purple-950/50 px-6 py-3 font-serif text-sm font-semibold text-amber-100 shadow-lg shadow-amber-900/30 transition-all hover:scale-105 hover:border-amber-500 hover:shadow-amber-500/40 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
                >
                  <span className="flex items-center gap-2">
                    Send
                    <span className="transition-transform group-hover:translate-x-0.5">→</span>
                  </span>
                </button>
              </form>
              <p className="mt-2 font-serif text-xs text-amber-100/30">
                Press Enter to send
              </p>
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
