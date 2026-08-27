// Wraps the Socket.IO ack-based contract in Backend/controllers/tournament.controller.js.
// Every event acks with { success, data } or { success: false, message }.
//
// Note: userId is never sent from here — the backend derives the caller's identity
// from the verified socket handshake (socket.user), not from the payload, so an
// authenticated request can't claim to be anyone else.

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

// tournament:list — public. Optional filters: { esportsGameId, status }.
export function listTournaments(socket, filters = {}) {
  return emitWithAck(socket, "tournament:list", filters);
}

// tournament:join — public. Guests must pass guestName; authenticated callers need
// neither (identity comes from the handshake). Team-mode tournaments additionally
// require teamName and a teammates array ([{ guestName, nickname? }, ...]) sized to
// exactly (tournament.team_size - 1) — the caller themselves fills the remaining slot.
export function joinTournament(socket, { tournamentId, guestName, nickname, teamName, teammates }) {
  return emitWithAck(socket, "tournament:join", {
    tournamentId,
    guestName,
    nickname,
    teamName,
    teammates,
  });
}

// tournament:leave — removes the caller's own registration by default. Pass
// participantId to remove a specific entry (self or admin), or teamId to withdraw
// an entire team (captain or admin).
export function leaveTournament(socket, { tournamentId, participantId, teamId }) {
  return emitWithAck(socket, "tournament:leave", { tournamentId, participantId, teamId });
}
