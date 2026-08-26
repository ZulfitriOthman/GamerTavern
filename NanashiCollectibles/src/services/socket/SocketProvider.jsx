import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "../../features/auth/AuthContext.js";
import { SocketContext } from "./SocketContext.js";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3002";

// NOTE (confirmed via backend audit, Phase 2): the backend does not currently verify
// this handshake token — there is no `io.use()` auth middleware in Backend/server.js,
// and no controller checks a signed token for socket events. Every socket controller
// that gates writes (tournament/news/decklist admin checks, product/trade ownership)
// trusts a plain, client-supplied id in the event payload instead. Sending the JWT here
// is forward-compatible (the day the backend adds real verification, this already works)
// but provides no actual security today — see CLAUDE.md "Socket.IO authentication".
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
