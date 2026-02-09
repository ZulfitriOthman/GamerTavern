// NanashiCollectibles/src/hooks/useSocket.js
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  getSocket,
  connectSocket,
  disconnectSocket,
} from "../socket/socketClient";

export function useSocket(username = null) {
  const [isConnected, setIsConnected] = useState(() => {
    const s = getSocket();
    return !!s?.connected;
  });

  const [onlineUsers, setOnlineUsers] = useState([]);
  const [activities, setActivities] = useState([]);

  const joinedRef = useRef(false);

  // ✅ Public connect/disconnect for pages (SignUp/Login)
  const connect = useCallback(
    (joinName = username) => {
      // connectSocket should create socket if not exists, and connect
      connectSocket();

      const s = getSocket();
      if (s && joinName && !joinedRef.current) {
        // If already connected, join immediately; else join when "connect" fires
        if (s.connected) {
          s.emit("user:join", joinName);
          joinedRef.current = true;
        }
      }
    },
    [username]
  );

  const disconnect = useCallback(() => {
    joinedRef.current = false;
    disconnectSocket();
  }, []);

  useEffect(() => {
    const s = getSocket();
    if (!s) return;

    function onConnect() {
      setIsConnected(true);

      // Join presence once per connection
      if (username && !joinedRef.current) {
        s.emit("user:join", username);
        joinedRef.current = true;
      }

      // Always request activities on connect
      s.emit("activities:request");
    }

    function onDisconnect() {
      setIsConnected(false);
      joinedRef.current = false;
    }

    function onUsersOnline(users) {
      setOnlineUsers(users || []);
    }

    function onActivityNew(activity) {
      setActivities((prev) => [activity, ...prev].slice(0, 50));
    }

    function onActivitiesList(activityList) {
      setActivities(activityList || []);
    }

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    s.on("users:online", onUsersOnline);
    s.on("activity:new", onActivityNew);
    s.on("activities:list", onActivitiesList);

    // If already connected when hook mounts
    if (s.connected) onConnect();

    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
      s.off("users:online", onUsersOnline);
      s.off("activity:new", onActivityNew);
      s.off("activities:list", onActivitiesList);
    };
  }, [username]);

  /* ---------------- Socket emit helpers ---------------- */

  const emitWithAck = useCallback((eventName, payload, timeoutMs = 8000) => {
  const s = getSocket();
  if (!s) return Promise.resolve({ success: false, message: "Socket not ready." });

  // 🔍 debug
  console.log("[socket][emit]", eventName, { connected: s.connected, payload });

  return new Promise((resolve) => {
    if (!s.connected) {
      return resolve({ success: false, message: "Socket is not connected." });
    }

    // Socket.IO v4 ack timeout
    s.timeout(timeoutMs).emit(eventName, payload, (err, res) => {
      if (err) {
        // err is usually: "operation has timed out"
        console.error("[socket][ack-timeout]", eventName, err);
        return resolve({ success: false, message: `Request timed out (${timeoutMs}ms).` });
      }

      console.log("[socket][ack]", eventName, res);
      resolve(res);
    });
  });
}, []);


  const emitAccountCreate = useCallback(
  (payload) => emitWithAck("account:create", payload),
  [emitWithAck]
);


  const emitAccountLogin = useCallback(
    (payload) => emitWithAck("account:login", payload),
    [emitWithAck]
  );

  const emitAccountRequestReset = useCallback(
    (payload) => emitWithAck("account:requestReset", payload),
    [emitWithAck]
  );

  const emitAccountResetPassword = useCallback(
    (payload) => emitWithAck("account:resetPassword", payload),
    [emitWithAck]
  );

  // optional: expose current socket instance for debugging
  const socket = useMemo(() => getSocket(), [isConnected]);

  return {
    socket,
    isConnected,
    onlineUsers,
    activities,

    // ✅ now your pages can call connect()
    connect,
    disconnect,

    // ✅ account helpers
    emitAccountCreate,
    emitAccountLogin,
    emitAccountRequestReset,
    emitAccountResetPassword,
  };
}
