export default function tradeSocketController({ socket, io, stores, pushActivity }) {
  socket.on("trade:create", (tradeData) => {
    const tradeId = `trade-${Date.now()}`;
    const trade = {
      id: tradeId,
      ...(tradeData || {}),
      createdAt: new Date().toISOString(),
      status: "pending",
    };

    stores.activeTrades.set(tradeId, trade);
    io.emit("trade:new", trade);

    const user = stores.onlineUsers.get(socket.id);
    pushActivity({
      id: Date.now(),
      type: "trade",
      message: `${user?.username || "Someone"} created a new trade offer`,
      timestamp: new Date().toISOString(),
    });
  });

  socket.on("trade:accept", (tradeId) => {
    const trade = stores.activeTrades.get(tradeId);
    if (!trade) return;

    trade.status = "accepted";
    trade.acceptedAt = new Date().toISOString();
    io.emit("trade:updated", trade);

    pushActivity({
      id: Date.now(),
      type: "trade",
      message: "Trade offer accepted!",
      timestamp: new Date().toISOString(),
    });
  });

  socket.on("trades:request", () => {
    socket.emit("trades:list", Array.from(stores.activeTrades.values()));
  });
}
