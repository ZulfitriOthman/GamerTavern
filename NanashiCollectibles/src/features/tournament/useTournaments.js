import { useCallback, useEffect, useState } from "react";
import { useSocket } from "../../services/socket/SocketContext.js";
import { listTournaments } from "./tournamentService.js";

// tournament:list is the only read event the backend exposes (no per-id "get" event),
// so the list is the single source of truth — detail views find(id) within it.
export function useTournaments() {
  const { socket, status: socketStatus } = useSocket();
  const [status, setStatus] = useState("loading"); // loading | success | error
  const [tournaments, setTournaments] = useState([]);
  const [error, setError] = useState(null);

  // No synchronous setState here — only inside the promise callbacks — so this is safe
  // to call directly from the effect below (react-hooks/set-state-in-effect).
  const load = useCallback(() => {
    if (!socket || socketStatus !== "connected") return undefined;
    return listTournaments(socket)
      .then((data) => {
        setTournaments(data || []);
        setStatus("success");
      })
      .catch((err) => {
        setError(err.message);
        setStatus("error");
      });
  }, [socket, socketStatus]);

  useEffect(() => {
    load();
  }, [load]);

  // Synchronously resets to "loading" — only safe to call from an event handler
  // (e.g. a "Try again" button), never from an effect.
  const refresh = useCallback(() => {
    setStatus("loading");
    setError(null);
    return load();
  }, [load]);

  useEffect(() => {
    if (!socket) return undefined;

    const upsert = (tournament) => {
      setTournaments((prev) => {
        const exists = prev.some((t) => t.id === tournament.id);
        return exists ? prev.map((t) => (t.id === tournament.id ? tournament : t)) : [...prev, tournament];
      });
    };
    const remove = ({ id }) => {
      setTournaments((prev) => prev.filter((t) => t.id !== id));
    };
    const mergeParticipants = ({ tournament_id, participants }) => {
      setTournaments((prev) =>
        prev.map((t) => (t.id === tournament_id ? { ...t, participants } : t))
      );
    };
    const mergeTeams = ({ tournament_id, teams }) => {
      setTournaments((prev) => prev.map((t) => (t.id === tournament_id ? { ...t, teams } : t)));
    };

    socket.on("tournament:created", upsert);
    socket.on("tournament:updated", upsert);
    socket.on("tournament:deleted", remove);
    socket.on("tournament:participants_updated", mergeParticipants);
    socket.on("tournament:teams_updated", mergeTeams);

    return () => {
      socket.off("tournament:created", upsert);
      socket.off("tournament:updated", upsert);
      socket.off("tournament:deleted", remove);
      socket.off("tournament:participants_updated", mergeParticipants);
      socket.off("tournament:teams_updated", mergeTeams);
    };
  }, [socket]);

  return { status, tournaments, error, socketStatus, refresh };
}
