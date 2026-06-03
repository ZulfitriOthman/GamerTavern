// NanashiCollectibles/src/socket/socketClient.js
import { io } from "socket.io-client";

let socket = null;
let lastUsername = null;

export const getSocket = () => socket;

function resolveSocketUrl() {
  const configured = (import.meta.env.VITE_SOCKET_URL?.trim() || "");
  const fallbackLocal = "http://localhost:3002";
  const runningOnLocalhost =
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1"].includes(window.location.hostname);

  if (!configured) return fallbackLocal;

  if (runningOnLocalhost) {
    try {
      const parsed = new URL(configured);
      const targetIsLocal = ["localhost", "127.0.0.1"].includes(parsed.hostname);
      if (!targetIsLocal) {
        console.warn(
          "[socket] Local dev detected: overriding VITE_SOCKET_URL with local backend",
          fallbackLocal,
        );
        return fallbackLocal;
      }
    } catch (_err) {
      // If configured URL is invalid, fallback to local backend in development.
      return fallbackLocal;
    }
  }

  return configured;
}

export const connectSocket = (username) => {
  const url = resolveSocketUrl();

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

      if (lastUsername) {
        console.log("👤 Emitting user:join with username:", lastUsername);
        socket.emit("user:join", lastUsername);
      } else {
        console.warn("⚠️ No username to join with");
      }

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
