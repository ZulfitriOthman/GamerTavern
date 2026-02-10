// NanashiCollectibles/src/socket/socketClient.js
import { io } from "socket.io-client";

let socket = null;
let lastUsername = null;

export const getSocket = () => socket;

export const connectSocket = (username) => {
  const url = (import.meta.env.VITE_SOCKET_URL || "http://localhost:3001").trim();

  // update remembered username (used for join on connect/reconnect)
  if (username) lastUsername = String(username).trim();

  if (!socket) {
    socket = io(url, {
      transports: ["polling", "websocket"],
      withCredentials: true,

      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      timeout: 15000,
    });

    socket.on("connect", () => {
      console.log("✅ Connected to Socket.IO:", socket.id, "->", url);

      // join on every connect/reconnect
      if (lastUsername) {
        socket.emit("user:join", lastUsername);
      }

      // request activities once per connection
      socket.emit("activities:request");
    });

    socket.on("disconnect", (reason) => {
      console.log("⚠️ Disconnected:", reason);
    });

    socket.on("connect_error", (err) => {
      console.log("❌ connect_error:", err?.message, err);
    });
  } else {
    // socket exists: if connected, apply username join immediately
    if (socket.connected && lastUsername) {
      socket.emit("user:join", lastUsername);
    }
  }

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.off();
    socket.disconnect();
    socket = null;
  }
};
