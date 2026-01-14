// src/hooks/useSocket.js
import { useEffect, useState, useCallback, useRef } from "react";
import { getSocket, connectSocket, disconnectSocket } from "../socket/socketClient";

/**
 * Custom hook to use Socket.IO in React components
 * @param {string|null} username - optional username for join presence
 */
export function useSocket(username = null) {
  const socket = getSocket();

  const [isConnected, setIsConnected] = useState(socket ? socket.connected : false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [activities, setActivities] = useState([]);

  const joinedRef = useRef(false);

  useEffect(() => {
    if (username) connectSocket(username);

    const s = getSocket();
    if (!s) return;

    function onConnect() {
      setIsConnected(true);

      if (username && !joinedRef.current) {
        s.emit("user:join", username);
        s.emit("activities:request");
        joinedRef.current = true;
      } else {
        s.emit("activities:request");
      }
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

    if (s.connected) onConnect();

    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
      s.off("users:online", onUsersOnline);
      s.off("activity:new", onActivityNew);
      s.off("activities:list", onActivitiesList);
    };
  }, [username]);

  /* ---------------- Account helpers ---------------- */

  const emitAccountCreate = useCallback((payload) => {
    const s = getSocket();
    if (!s) return Promise.resolve({ success: false, message: "Socket not ready." });

    return new Promise((resolve) => {
      s.emit("account:create", payload, (res) => resolve(res));
    });
  }, []);

  const emitAccountLogin = useCallback((payload) => {
    const s = getSocket();
    if (!s) return Promise.resolve({ success: false, message: "Socket not ready." });

    return new Promise((resolve) => {
      s.emit("account:login", payload, (res) => resolve(res));
    });
  }, []);

  return {
    socket: getSocket(),
    isConnected,
    onlineUsers,
    activities,

    emitAccountCreate,
    emitAccountLogin,

    connect: connectSocket,
    disconnect: disconnectSocket,
  };
}
