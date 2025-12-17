import { io } from "socket.io-client";

let socket = null;

/**
 * Get current socket instance (may be null before connect)
 */
export const getSocket = () => socket;

/**
 * Connect socket (singleton)
 * - Uses VITE_SOCKET_URL for production
 * - Emits user:join after connect
 */
export const connectSocket = (username) => {
  const url =
    import.meta.env.VITE_SOCKET_URL?.trim() || "http://localhost:3001";

  // create once
  if (!socket) {
    socket = io(url, {
      transports: ["websocket"], // best for Cloudflare / Nginx
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      timeout: 10000,
    });

    // Optional debug
    socket.on("connect", () => {
      console.log("✅ Connected to Socket.IO:", socket.id, "->", url);
    });
    socket.on("disconnect", (reason) => {
      console.log("⚠️ Disconnected:", reason);
    });
    socket.on("connect_error", (err) => {
      console.log("❌ connect_error:", err?.message, err);
    });
  }

  // Join immediately (if not connected yet, server will receive it after connect anyway)
  if (username) {
    socket.emit("user:join", username);
  }

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
