// NanashiCollectibles/src/socket/socketClient.js
import { io } from "socket.io-client";

let socket = null;
let lastUsername = null;

export const getSocket = () => socket;

export const connectSocket = (username) => {
  const url = (import.meta.env.VITE_SOCKET_URL || "http://localhost:3001").trim();

  if (username) lastUsername = String(username).trim();

  if (!socket) {
    socket = io(url, {
      transports: ["websocket", "polling"],
      withCredentials: true,

      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      timeout: 15000,
    });

    socket.on("connect", () => {
      console.log("✅ Connected to Socket.IO:", socket.id, "->", url);

      if (lastUsername) socket.emit("user:join", lastUsername);

      socket.emit("activities:request");
    });

    socket.on("disconnect", (reason) => {
      console.log("⚠️ Disconnected:", reason);
    });

    socket.on("connect_error", (err) => {
      console.log("❌ connect_error:", err?.message, err);
    });
  } else {
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

export const waitForSocketConnected = (timeoutMs = 4000) =>
  new Promise((resolve) => {
    const s = connectSocket(lastUsername);

    if (s?.connected) return resolve(true);

    const timer = setTimeout(() => {
      cleanup();
      resolve(false);
    }, timeoutMs);

    const onConnect = () => {
      cleanup();
      resolve(true);
    };

    const onError = () => {
      cleanup();
      resolve(false);
    };

    function cleanup() {
      clearTimeout(timer);
      s.off("connect", onConnect);
      s.off("connect_error", onError);
    }

    s.on("connect", onConnect);
    s.on("connect_error", onError);
  });
