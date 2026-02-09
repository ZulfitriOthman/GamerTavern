// NanashiCollectibles/src/socket/socketClient.js
import { io } from "socket.io-client";

let socket = null;
let lastUsername = null;

export const getSocket = () => socket;

export const connectSocket = (username) => {
  const url = (import.meta.env.VITE_SOCKET_URL || "http://localhost:3001").trim();

  lastUsername = username || lastUsername;

  // ✅ create once
  if (!socket) {
    socket = io(url, {
      // ✅ allow fallback (fixes most Cloudflare/Nginx/proxy setups)
      transports: ["polling", "websocket"],
      withCredentials: true,

      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      timeout: 15000,
    });

    socket.on("connect", () => {
      console.log("✅ Connected to Socket.IO:", socket.id, "->", url);

      // ✅ join on connect (and on every reconnect)
      if (lastUsername) {
        socket.emit("user:join", lastUsername);
      }
    });

    socket.on("disconnect", (reason) => {
      console.log("⚠️ Disconnected:", reason);
    });

    socket.on("connect_error", (err) => {
      console.log("❌ connect_error:", err?.message, err);
    });
  } else {
    // If socket already exists + connected, ensure username join is applied
    if (socket.connected && lastUsername) {
      socket.emit("user:join", lastUsername);
    }
  }

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.off(); // remove listeners
    socket.disconnect();
    socket = null;
  }
};
