// Custom React Hook for Socket.IO
import { useEffect, useState, useCallback } from 'react';
import { socket, connectSocket, disconnectSocket } from '../socket/socketClient';

/**
 * Custom hook to use Socket.IO in React components
 * @param {string} username - Optional username for the user
 * @returns {object} Socket utilities and state
 */
export function useSocket(username = null) {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    // Connect socket when component mounts
    if (username) {
      connectSocket(username);
    }

    // Socket event listeners
    function onConnect() {
      setIsConnected(true);
    }

    function onDisconnect() {
      setIsConnected(false);
    }

    function onUsersOnline(users) {
      setOnlineUsers(users);
    }

    function onActivityNew(activity) {
      setActivities((prev) => [activity, ...prev].slice(0, 50)); // Keep last 50
    }

    function onActivitiesList(activityList) {
      setActivities(activityList);
    }

    // Register event listeners
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('users:online', onUsersOnline);
    socket.on('activity:new', onActivityNew);
    socket.on('activities:list', onActivitiesList);

    // Request initial data
    if (socket.connected) {
      socket.emit('activities:request');
    }

    // Cleanup on unmount
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('users:online', onUsersOnline);
      socket.off('activity:new', onActivityNew);
      socket.off('activities:list', onActivitiesList);
    };
  }, [username]);

  // Emit cart add event
  const emitCartAdd = useCallback((productName) => {
    socket.emit('cart:add', { productName });
  }, []);

  // Emit product add event
  const emitProductNew = useCallback((product) => {
    socket.emit('product:new', product);
  }, []);

  // Emit trade create event
  const emitTradeCreate = useCallback((tradeData) => {
    socket.emit('trade:create', tradeData);
  }, []);

  // Emit chat message
  const emitChatMessage = useCallback((message) => {
    socket.emit('chat:message', message);
  }, []);

  return {
    socket,
    isConnected,
    onlineUsers,
    activities,
    emitCartAdd,
    emitProductNew,
    emitTradeCreate,
    emitChatMessage,
    connect: connectSocket,
    disconnect: disconnectSocket
  };
}
