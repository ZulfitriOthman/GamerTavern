import { io } from 'socket.io-client'

let socketInstance = null

function getSocketBaseUrl() {
  return import.meta.env.VITE_API_URL || 'http://localhost:3002'
}

export function connectAdminSocket(token) {
  if (!token) {
    return null
  }

  if (socketInstance?.connected) {
    return socketInstance
  }

  socketInstance = io(getSocketBaseUrl(), {
    transports: ['websocket', 'polling'],
    withCredentials: true,
    auth: {
      token,
    },
  })

  return socketInstance
}

export function getAdminSocket() {
  return socketInstance
}

export function disconnectAdminSocket() {
  if (socketInstance) {
    socketInstance.disconnect()
    socketInstance = null
  }
}
