// NanashiCollectibles/src/hooks/useSocket.js
import { useEffect, useState, useCallback, useMemo } from "react";
import { getSocket, connectSocket, disconnectSocket } from "../socket/socketClient";

/**
 * Module-level (global) store so multiple components don't attach duplicate listeners.
 */
let listenersAttached = false;

let globalState = {
  isConnected: false,
  onlineUsers: [],
  activities: [],
};

const subscribers = new Set();

function notify() {
  for (const fn of subscribers) fn(globalState);
}

function attachListenersOnce() {
  const s = getSocket();
  if (!s || listenersAttached) return;

  listenersAttached = true;

  const onConnect = () => {
    globalState = { ...globalState, isConnected: true };
    notify();
  };

  const onDisconnect = () => {
    globalState = { ...globalState, isConnected: false };
    notify();
  };

  const onUsersOnline = (users) => {
    globalState = { ...globalState, onlineUsers: Array.isArray(users) ? users : [] };
    notify();
  };

  const onActivityNew = (activity) => {
    const next = [activity, ...(globalState.activities || [])].slice(0, 50);
    globalState = { ...globalState, activities: next };
    notify();
  };

  const onActivitiesList = (activityList) => {
    globalState = {
      ...globalState,
      activities: Array.isArray(activityList) ? activityList : [],
    };
    notify();
  };

  s.on("connect", onConnect);
  s.on("disconnect", onDisconnect);
  s.on("users:online", onUsersOnline);
  s.on("activity:new", onActivityNew);
  s.on("activities:list", onActivitiesList);

  // initialize if already connected
  if (s.connected) onConnect();
}

export function useSocket(username = null) {
  const [isConnected, setIsConnected] = useState(() => {
    const s = getSocket();
    return !!s?.connected;
  });

  const [onlineUsers, setOnlineUsers] = useState([]);
  const [activities, setActivities] = useState([]);

  /**
   * Public connect/disconnect for pages (SignUp/Login/Chat/OnlineUsers)
   * - This does NOT attach duplicate listeners.
   * - This updates username join safely via socketClient.
   */
  const connect = useCallback(
    (joinName = username) => {
      connectSocket(joinName);
      attachListenersOnce();
    },
    [username],
  );

  const disconnect = useCallback(() => {
    disconnectSocket();
    listenersAttached = false; // allow re-attach if a new socket is created later

    globalState = {
      isConnected: false,
      onlineUsers: [],
      activities: [],
    };
    notify();
  }, []);

  // Auto-connect if username is provided (ChatPage / OnlineUsers usage)
  useEffect(() => {
    if (username) {
      connect(username);
    } else {
      // still ensure listeners if socket already exists
      const s = getSocket();
      if (s) attachListenersOnce();
    }
  }, [username, connect]);

  // Subscribe this hook instance to global store updates
  useEffect(() => {
    const handler = (state) => {
      setIsConnected(!!state.isConnected);
      setOnlineUsers(state.onlineUsers || []);
      setActivities(state.activities || []);
    };

    subscribers.add(handler);

    // push latest immediately
    handler(globalState);

    return () => {
      subscribers.delete(handler);
    };
  }, []);

  /* ---------------- Socket emit helpers ---------------- */

  const emitWithAck = useCallback((eventName, payload, timeoutMs = 8000) => {
    const s = getSocket();
    if (!s) return Promise.resolve({ success: false, message: "Socket not ready." });

    console.log("[socket][emit]", eventName, { connected: s.connected, payload });

    return new Promise((resolve) => {
      if (!s.connected) {
        return resolve({ success: false, message: "Socket is not connected." });
      }

      s.timeout(timeoutMs).emit(eventName, payload, (err, res) => {
        if (err) {
          console.error("[socket][ack-timeout]", eventName, err);
          return resolve({
            success: false,
            message: `Request timed out (${timeoutMs}ms).`,
          });
        }

        console.log("[socket][ack]", eventName, res);
        resolve(res);
      });
    });
  }, []);

  const emitAccountCreate = useCallback(
    (payload) => emitWithAck("account:create", payload),
    [emitWithAck],
  );

  const emitAccountLogin = useCallback(
    (payload) => emitWithAck("account:login", payload),
    [emitWithAck],
  );

  const emitAccountRequestReset = useCallback(
    (payload) => emitWithAck("account:requestReset", payload),
    [emitWithAck],
  );

  const emitAccountResetPassword = useCallback(
    (payload) => emitWithAck("account:resetPassword", payload),
    [emitWithAck],
  );

  const socket = useMemo(() => getSocket(), [isConnected]);

  return {
    socket,
    isConnected,
    onlineUsers,
    activities,

    connect,
    disconnect,

    emitAccountCreate,
    emitAccountLogin,
    emitAccountRequestReset,
    emitAccountResetPassword,
  };
}
