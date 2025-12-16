// Socket.IO Client Configuration for GamerTavern
import { io } from 'socket.io-client';

// Socket connection configuration
const SOCKET_URL = 'http://localhost:3001';

// Create socket instance (will connect when needed)
export const socket = io(SOCKET_URL, {
  autoConnect: false, // We'll connect manually
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5
});

// Socket event listeners for debugging
socket.on('connect', () => {
  console.log('✅ Connected to Socket.IO server:', socket.id);
});

socket.on('disconnect', (reason) => {
  console.log('❌ Disconnected from server:', reason);
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error.message);
});

// Helper function to connect socket
export const connectSocket = (username) => {
  if (!socket.connected) {
    socket.connect();
    if (username) {
      socket.emit('user:join', username);
    }
  }
};

// Helper function to disconnect socket
export const disconnectSocket = () => {
  if (socket.connected) {
    socket.disconnect();
  }
};

// Export socket instance as default
export default socket;
