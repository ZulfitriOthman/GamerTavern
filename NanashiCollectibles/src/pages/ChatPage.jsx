// Chat Page - Real-time Chat with Socket.IO
import { useState, useEffect, useRef, useMemo } from "react";
import { useSocket } from "../hooks/useSocket";
import OnlineUsers from "../components/OnlineUsers";
import LiveActivityFeed from "../components/LiveActivityFeed";
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
    return u ? { ...u, username: u?.name || u?.username || fallback } : { username: fallback };
  });

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const inputRef = useRef(null);
  const username = useMemo(() => {
    return currentUser?.username || getUsername("Guest") || "Guest";
  }, [currentUser]);

  const { isConnected, socket, onlineUsers } = useSocket(username);

  const normalizedMessages = useMemo(() => {
    return messages.map((message) => {
      const messageUsername = message?.username || message?.user || "Unknown";
      const messageText = message?.message ?? message?.text ?? "";
      const messageTime = message?.timestamp || message?.created_at || Date.now();

      return {
        id: message.id || `${messageUsername}-${messageTime}-${messageText.slice(0, 8)}`,
        username: messageUsername,
        text: String(messageText || ""),
        timestamp: messageTime,
        isOwnMessage: messageUsername === (currentUser?.username || username),
      };
    });
  }, [messages, currentUser, username]);

  const chatStats = useMemo(() => {
    const uniqueParticipants = new Set(
      normalizedMessages.map((message) => message.username).filter(Boolean),
    );

    (Array.isArray(onlineUsers) ? onlineUsers : []).forEach((user) => {
      if (user?.username) uniqueParticipants.add(user.username);
    });

    const latestMessage = normalizedMessages.at(-1);

    return {
      totalMessages: normalizedMessages.length,
      activeCollectors: uniqueParticipants.size,
      latestMessageTime: latestMessage?.timestamp || null,
    };
  }, [normalizedMessages, onlineUsers]);

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

  useEffect(() => {
    if (!socket) return;

    function onChatHistory(history) {
      const nextMessages = Array.isArray(history) ? history : [];
      setMessages(nextMessages);
    }

    function onChatMessage(message) {
      console.log("📨 Received:", message);
      setMessages((prev) => {
        if (prev.some(m => m.id === message.id)) return prev;
        return [...prev, message];
      });
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

    socket.on("chat:history", onChatHistory);
    socket.on("chat:message", onChatMessage);
    socket.on("chat:typing", onUserTyping);

    socket.emit("chat:history");

    return () => {
      socket.off("chat:history", onChatHistory);
      socket.off("chat:message", onChatMessage);
      socket.off("chat:typing", onUserTyping);
    };
  }, [socket, username]);

  useEffect(() => {
    if (!socket || !isConnected) return;

    socket.emit("activities:request");
  }, [socket, isConnected]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  const formatLastSeen = (timestamp) => {
    if (!timestamp) return "Waiting for the first message";

    const date = new Date(timestamp);
    const diff = Date.now() - date.getTime();

    if (diff < 60_000) return "Updated just now";
    if (diff < 3_600_000) return `Updated ${Math.floor(diff / 60_000)}m ago`;

    return `Updated at ${formatTime(timestamp)}`;
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
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

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-amber-900/30 bg-slate-950/40 px-4 py-3">
                <p className="font-serif text-[11px] uppercase tracking-[0.24em] text-amber-100/45">
                  Message Log
                </p>
                <p className="mt-2 font-serif text-2xl font-semibold text-amber-100">
                  {chatStats.totalMessages}
                </p>
                <p className="font-serif text-xs text-amber-100/55">
                  Messages in this live session
                </p>
              </div>

              <div className="rounded-xl border border-amber-900/30 bg-slate-950/40 px-4 py-3">
                <p className="font-serif text-[11px] uppercase tracking-[0.24em] text-amber-100/45">
                  Active Collectors
                </p>
                <p className="mt-2 font-serif text-2xl font-semibold text-amber-100">
                  {chatStats.activeCollectors}
                </p>
                <p className="font-serif text-xs text-amber-100/55">
                  Players visible in chat or online now
                </p>
              </div>

              <div className="rounded-xl border border-amber-900/30 bg-slate-950/40 px-4 py-3">
                <p className="font-serif text-[11px] uppercase tracking-[0.24em] text-amber-100/45">
                  Channel Pulse
                </p>
                <p className="mt-2 font-serif text-sm font-semibold text-amber-100">
                  {formatLastSeen(chatStats.latestMessageTime)}
                </p>
                <p className="font-serif text-xs text-amber-100/55">
                  Realtime socket activity snapshot
                </p>
              </div>
            </div>

            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-amber-900/30 bg-gradient-to-br from-slate-950 to-purple-950/30 shadow-lg shadow-purple-900/20">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />

            <div className="border-b border-amber-900/20 bg-slate-950/40 px-6 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-serif text-lg font-semibold text-amber-100">
                    Collector Hall
                  </h2>
                  <p className="font-serif text-xs text-amber-100/55">
                    Live discussion for trades, card checks, and marketplace chatter.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-amber-700/30 bg-amber-950/20 px-3 py-1 font-serif text-[11px] text-amber-200/85">
                    {isConnected ? "Socket ready" : "Socket offline"}
                  </span>
                  <span className="rounded-full border border-amber-700/30 bg-slate-950/60 px-3 py-1 font-serif text-[11px] text-amber-100/70">
                    {typingUsers.size > 0
                      ? `${typingUsers.size} collector${typingUsers.size === 1 ? "" : "s"} typing`
                      : "Quiet chamber"}
                  </span>
                </div>
              </div>
            </div>

            <div className="h-[500px] overflow-y-auto p-6 space-y-4">
              {normalizedMessages.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <div className="max-w-md rounded-2xl border border-amber-900/20 bg-slate-950/40 px-6 py-8 text-center">
                    <p className="font-serif text-base font-semibold text-amber-100">
                      The hall is quiet.
                    </p>
                    <p className="mt-2 font-serif text-sm italic text-amber-100/50">
                      {isConnected
                        ? "Open the conversation with a trade question, card lookup, or collector update."
                        : "Reconnect to the socket to start sending messages."}
                    </p>
                  </div>
                </div>
              ) : (
                normalizedMessages.map((msg) => {
                  const initials = (msg.username || "?")
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((part) => part[0]?.toUpperCase())
                    .join("");

                  return (
                    <div
                      key={msg.id}
                      className={`flex ${
                        msg.isOwnMessage ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`flex max-w-[78%] items-start gap-3 rounded-2xl p-3 ${
                          msg.isOwnMessage
                            ? "border border-amber-600/40 bg-gradient-to-r from-amber-950/50 to-purple-950/50"
                            : "border border-amber-900/20 bg-slate-950/70"
                        }`}
                      >
                        {!msg.isOwnMessage && (
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-700/30 bg-amber-950/25 font-serif text-xs font-semibold text-amber-300">
                            {initials || "?"}
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex items-center gap-2">
                            <span className="font-serif text-xs font-semibold text-amber-400">
                              {msg.username}
                            </span>
                            <span className="font-serif text-[10px] text-amber-100/40">
                              {formatTime(msg.timestamp)}
                            </span>
                            {msg.isOwnMessage && (
                              <span className="rounded-full border border-amber-600/30 bg-amber-950/30 px-2 py-0.5 font-serif text-[10px] text-amber-200/80">
                                You
                              </span>
                            )}
                          </div>

                          <p className="whitespace-pre-wrap break-words font-serif text-sm leading-6 text-amber-100/90">
                            {msg.text}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              
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

        <div className="space-y-4">
          <OnlineUsers />
          <LiveActivityFeed />

          <div className="relative overflow-hidden rounded-xl border border-amber-900/30 bg-gradient-to-br from-slate-950 to-purple-950/30 p-4 shadow-lg shadow-purple-900/20">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />

            <h3 className="font-serif text-sm font-bold text-amber-100">
              Hall Etiquette
            </h3>
            <ul className="mt-3 space-y-2 font-serif text-xs text-amber-100/65">
              <li>Keep trade details clear so other collectors can verify condition and price.</li>
              <li>Use the live activity feed to spot shop, stock, and trade movement while chatting.</li>
              <li>Short updates land faster when the socket reconnects after a network drop.</li>
            </ul>

            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChatPage;
