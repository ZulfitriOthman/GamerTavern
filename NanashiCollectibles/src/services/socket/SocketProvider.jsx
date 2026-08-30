import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "../../features/auth/AuthContext.js";
import { SocketContext } from "./SocketContext.js";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3002";

// NOTE (confirmed via backend audit, Phase 8): Backend/server.js's io.use() handshake
// middleware verifies this token server-side (Backend/modules/jwt.module.js) and sets
// socket.user from the decoded payload — a missing or invalid token connects as a guest
// (socket.user = null) rather than being rejected, but never grants authenticated
// privileges. Authorization then reads identity only from socket.user, never from a
// client-supplied payload field — see CLAUDE.md "Socket.IO authentication".
export function SocketProvider({ children }) {
  const { token, status: authStatus } = useAuth();
  const [socket, setSocket] = useState(null);
  const [status, setStatus] = useState("connecting"); // connecting | connected | disconnected | error

  useEffect(() => {
    // Wait for the auth session to resolve so we don't open a connection and then
    // immediately reconnect once the stored token loads.
    if (authStatus === "loading") return undefined;

    const newSocket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      auth: token ? { token } : {},
    });

    const handleConnect = () => setStatus("connected");
    const handleDisconnect = () => setStatus("disconnected");
    const handleConnectError = () => setStatus("error");

    newSocket.on("connect", handleConnect);
    newSocket.on("disconnect", handleDisconnect);
    newSocket.on("connect_error", handleConnectError);

    // Publishing the new connection and resetting status is deferred by one microtask
    // so it isn't a synchronous setState call in the effect body itself
    // (react-hooks/set-state-in-effect). This is safe, not just cosmetic: socket.io's
    // connect/disconnect/connect_error events require an actual network round-trip, so
    // they can never fire before a same-tick microtask resolves — there's no ordering
    // race with the handlers registered just above.
    Promise.resolve().then(() => {
      setSocket(newSocket);
      setStatus("connecting");
    });

    return () => {
      newSocket.off("connect", handleConnect);
      newSocket.off("disconnect", handleDisconnect);
      newSocket.off("connect_error", handleConnectError);
      newSocket.disconnect();
    };
  }, [token, authStatus]);

  const value = useMemo(() => ({ socket, status }), [socket, status]);

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}
