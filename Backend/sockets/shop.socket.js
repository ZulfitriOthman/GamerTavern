export default function shopSocketController({ socket, io, stores, pushActivity }) {
  console.log("✅ User connected:", socket.id);

  socket.on("user:join", (username) => {
    const safeName = String(username || "").trim() || "Anonymous";
    stores.onlineUsers.set(socket.id, { username: safeName, socketId: socket.id });

    io.emit("users:online", Array.from(stores.onlineUsers.values()));
    socket.broadcast.emit("user:joined", { username: safeName });
  });

  socket.on("product:new", (product) => {
    io.emit("product:added", product);

    pushActivity({
      id: Date.now(),
      type: "product",
      message: `New ${product?.name || "item"} added to shop!`,
      timestamp: new Date().toISOString(),
    });
  });

  socket.on("cart:add", (data) => {
    const user = stores.onlineUsers.get(socket.id);

    pushActivity({
      id: Date.now(),
      type: "cart",
      message: `${user?.username || "Someone"} added ${data?.productName || "an item"} to cart`,
      timestamp: new Date().toISOString(),
    });
  });

  socket.on("disconnect", () => {
    const user = stores.onlineUsers.get(socket.id);
    stores.onlineUsers.delete(socket.id);

    io.emit("users:online", Array.from(stores.onlineUsers.values()));
    if (user) socket.broadcast.emit("user:left", { username: user.username });
  });
}
