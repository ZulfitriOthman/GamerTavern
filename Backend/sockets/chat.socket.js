export default function chatSocketController({ socket, io, stores }) {
  // Handle chat messages
  socket.on("chat:message", (message) => {
    const user = stores.onlineUsers.get(socket.id);
    
    // Ensure message is a string
    const messageText = String(message || "").trim();
    
    if (!messageText) {
      console.log("⚠️ Empty message received from", socket.id);
      return;
    }

    const chatMessage = {
      id: `${Date.now()}-${socket.id}`,
      username: user?.username || "Anonymous",
      message: messageText,
      timestamp: new Date().toISOString(),
    };

    console.log("📨 Broadcasting chat message:", chatMessage);
    io.emit("chat:message", chatMessage);
  });

  // Handle typing indicator
  socket.on("chat:typing", ({ username }) => {
    const user = stores.onlineUsers.get(socket.id);
    const displayName = username || user?.username || "Anonymous";
    
    // Broadcast to everyone except sender
    socket.broadcast.emit("chat:typing", { username: displayName });
  });

  // Handle activities request
  socket.on("activities:request", () => {
    socket.emit("activities:list", stores.recentActivities);
  });
}
