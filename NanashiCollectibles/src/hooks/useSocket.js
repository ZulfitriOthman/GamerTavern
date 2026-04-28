// NanashiCollectibles/src/hooks/useSocket.js
import { useEffect, useState, useCallback, useMemo } from "react";
import { getSocket, connectSocket, disconnectSocket } from "../socket/socketClient";

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
    console.log("👥 Received users:online event:", users);
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

  if (s.connected) onConnect();
}

export function useSocket(username = null) {
  const [isConnected, setIsConnected] = useState(() => {
    const s = getSocket();
    return !!s?.connected;
  });

  const [onlineUsers, setOnlineUsers] = useState([]);
  const [activities, setActivities] = useState([]);

  const connect = useCallback(
    (joinName = username) => {
      connectSocket(joinName);
      attachListenersOnce();
    },
    [username],
  );

  const disconnect = useCallback(() => {
    disconnectSocket();
    listenersAttached = false; 

    globalState = {
      isConnected: false,
      onlineUsers: [],
      activities: [],
    };
    notify();
  }, []);

  useEffect(() => {
    if (username) {
      connect(username);
    } else {
      const s = getSocket();
      if (s) attachListenersOnce();
    }
  }, [username, connect]);

  useEffect(() => {
    const handler = (state) => {
      setIsConnected(!!state.isConnected);
      setOnlineUsers(state.onlineUsers || []);
      setActivities(state.activities || []);
    };

    subscribers.add(handler);

    handler(globalState);

    return () => {
      subscribers.delete(handler);
    };
  }, []);

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

  const emitAccountUpdate = useCallback(
    (payload) => emitWithAck("account:update", payload),
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

  const emitCountryList = useCallback(
    () => emitWithAck("country:list", null),
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
    emitAccountUpdate,
    emitAccountLogin,
    emitAccountRequestReset,
    emitAccountResetPassword,
    emitCountryList,
  };
}
