// Custom React Hook for Socket.IO
import { useEffect, useState, useCallback, useRef } from "react";
import {
  getSocket,
  connectSocket,
  disconnectSocket,
} from "../socket/socketClient";

/**
 * Custom hook to use Socket.IO in React components
 * @param {string} username - username for the user (recommended)
 * @returns {object} Socket utilities and state
 */
export function useSocket(username = null) {
  const socket = getSocket(); // always returns the singleton socket instance (or null if not created yet)

  const [isConnected, setIsConnected] = useState(
    socket ? socket.connected : false
  );
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [activities, setActivities] = useState([]);

  // Prevent double connect spam
  const joinedRef = useRef(false);

  useEffect(() => {
    // If we have a username, ensure connection exists
    if (username) {
      connectSocket(username);
    }

    const s = getSocket();
    if (!s) return;

    function onConnect() {
      setIsConnected(true);

      // ✅ join once after connect (and request initial data)
      if (username && !joinedRef.current) {
        s.emit("user:join", username);
        s.emit("activities:request");
        joinedRef.current = true;
      } else {
        // still request activities if you want
        s.emit("activities:request");
      }
    }

    function onDisconnect() {
      setIsConnected(false);
      joinedRef.current = false; // allow re-join after reconnect
    }

    function onUsersOnline(users) {
      setOnlineUsers(users);
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

    // If already connected, run connect flow
    if (s.connected) onConnect();

    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
      s.off("users:online", onUsersOnline);
      s.off("activity:new", onActivityNew);
      s.off("activities:list", onActivitiesList);
    };
  }, [username]);

  const emitCartAdd = useCallback((productName) => {
    const s = getSocket();
    if (!s) return;
    s.emit("cart:add", { productName });
  }, []);

  const emitProductNew = useCallback((product) => {
    const s = getSocket();
    if (!s) return;
    s.emit("product:new", product);
  }, []);

  const emitTradeCreate = useCallback((tradeData) => {
    const s = getSocket();
    if (!s) return;
    s.emit("trade:create", tradeData);
  }, []);

  const emitChatMessage = useCallback((message) => {
    const s = getSocket();
    if (!s) return;
    s.emit("chat:message", message);
  }, []);

  return {
    socket: getSocket(),
    isConnected,
    onlineUsers,
    activities,
    emitCartAdd,
    emitProductNew,
    emitTradeCreate,
    emitChatMessage,
    connect: connectSocket,
    disconnect: disconnectSocket,
  };
}
