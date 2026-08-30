// Shared Socket.IO ack-based request helper. Every socket event contract in this app
// acks with { success, data } or { success: false, message } — wrapped once here
// instead of duplicated per feature service.
const ACK_TIMEOUT_MS = 8000;

export function emitWithAck(socket, event, payload) {
  return new Promise((resolve, reject) => {
    if (!socket || !socket.connected) {
      reject(new Error("Not connected to the server."));
      return;
    }

    socket.timeout(ACK_TIMEOUT_MS).emit(event, payload, (err, response) => {
      if (err) {
        reject(new Error("The server took too long to respond. Please try again."));
        return;
      }
      if (!response?.success) {
        reject(new Error(response?.message || "Request failed."));
        return;
      }
      resolve(response.data);
    });
  });
}
