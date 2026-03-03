export default function shopSocketController({ socket, io, stores, pushActivity }) {
  console.log("✅ User connected:", socket.id);

  // Handle user join
  socket.on("user:join", (username) => {
    const safeName = String(username || "").trim() || "Anonymous";
    console.log("👤 user:join -", safeName, "| socketId:", socket.id);
    
    stores.onlineUsers.set(socket.id, { username: safeName, socketId: socket.id });
    
    const onlineList = Array.from(stores.onlineUsers.values());
    console.log("📋 Online users count:", onlineList.length);

    io.emit("users:online", onlineList);
    socket.broadcast.emit("user:joined", { username: safeName });
  });

  // Handle new products
  socket.on("product:new", (product) => {
    console.log("🆕 New product:", product?.name);
    io.emit("product:added", product);

    pushActivity({
      id: Date.now(),
      type: "product",
      message: `New ${product?.name || "item"} added to shop!`,
      timestamp: new Date().toISOString(),
    });
  });

  // Handle cart additions
  socket.on("cart:add", (data) => {
    const user = stores.onlineUsers.get(socket.id);

    pushActivity({
      id: Date.now(),
      type: "cart",
      message: `${user?.username || "Someone"} added ${data?.productName || "an item"} to cart`,
      timestamp: new Date().toISOString(),
    });
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    const user = stores.onlineUsers.get(socket.id);
    stores.onlineUsers.delete(socket.id);

    console.log("👋 User disconnected:", user?.username || "Unknown", "| socketId:", socket.id);

    const onlineList = Array.from(stores.onlineUsers.values());
    io.emit("users:online", onlineList);
    
    if (user) {
      socket.broadcast.emit("user:left", { username: user.username });
    }
  });
}
