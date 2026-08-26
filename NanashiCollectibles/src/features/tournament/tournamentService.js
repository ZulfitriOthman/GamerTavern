// Wraps the Socket.IO ack-based contract in Backend/controllers/tournament.controller.js.
// Every event acks with { success, data } or { success: false, message }.

const ACK_TIMEOUT_MS = 8000;

function emitWithAck(socket, event, payload) {
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

// tournament:list — public. Optional filters: { game, month } (month as "YYYY-MM").
export function listTournaments(socket, filters = {}) {
  return emitWithAck(socket, "tournament:list", filters);
}

// tournament:join — public. Either userId (authenticated) or guestName (guest) is required.
export function joinTournament(socket, { tournamentId, userId, guestName, nickname, teamName }) {
  return emitWithAck(socket, "tournament:join", {
    tournamentId,
    userId,
    guestName,
    nickname,
    teamName,
  });
}

// tournament:leave — requires userId (own entry) or participantId (self or admin removal).
export function leaveTournament(socket, { tournamentId, userId, participantId }) {
  return emitWithAck(socket, "tournament:leave", { tournamentId, userId, participantId });
}
