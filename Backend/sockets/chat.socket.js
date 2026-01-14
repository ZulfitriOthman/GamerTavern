export default function chatSocketController({ socket, io, stores }) {
  socket.on("chat:message", (message) => {
    const user = stores.onlineUsers.get(socket.id);

    const chatMessage = {
      id: Date.now(),
      username: user?.username || "Anonymous",
      message: String(message || ""),
      timestamp: new Date().toISOString(),
    };

    io.emit("chat:message", chatMessage);
  });

  socket.on("activities:request", () => {
    socket.emit("activities:list", stores.recentActivities);
  });
}
