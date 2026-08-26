import { useState } from "react";
import Button from "../../components/ui/Button.jsx";
import { useAuth } from "../auth/AuthContext.js";
import { useSocket } from "../../services/socket/SocketContext.js";
import { joinTournament, leaveTournament } from "./tournamentService.js";

const fieldClasses =
  "w-full rounded-lg border border-white/10 bg-ink-900 px-3.5 py-2.5 text-sm text-amber-50 placeholder:text-amber-50/30 focus:border-brand-400 focus:outline-none";

export default function TournamentRegistrationForm({ tournament }) {
  const { status: authStatus, user } = useAuth();
  const { socket, status: socketStatus } = useSocket();

  const [guestName, setGuestName] = useState("");
  const [nickname, setNickname] = useState("");
  const [teamName, setTeamName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const isAuthenticated = authStatus === "authenticated";
  const userId = isAuthenticated ? user.sub : null;

  const myEntry = isAuthenticated
    ? tournament.participants?.find((p) => String(p.user_id) === String(userId))
    : null;

  const spotsLeft =
    tournament.max_teams != null ? tournament.max_teams - (tournament.participants?.length || 0) : null;
  const isFull = spotsLeft != null && spotsLeft <= 0;
  const deadlinePassed =
    tournament.registration_deadline && new Date(tournament.registration_deadline) < new Date();

  async function handleJoin(event) {
    event.preventDefault();
    setError(null);

    if (!isAuthenticated && !guestName.trim()) {
      setError("Enter a display name to join as a guest.");
      return;
    }

    setSubmitting(true);
    try {
      await joinTournament(socket, {
        tournamentId: tournament.id,
        userId: userId || undefined,
        guestName: isAuthenticated ? undefined : guestName.trim(),
        nickname: nickname.trim() || undefined,
        teamName: teamName.trim() || undefined,
      });
      setGuestName("");
      setNickname("");
      setTeamName("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLeave() {
    setError(null);
    setSubmitting(true);
    try {
      await leaveTournament(socket, { tournamentId: tournament.id, userId });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (socketStatus !== "connected") {
    return <p className="text-sm text-amber-50/50">Connecting to the tournament server…</p>;
  }

  if (myEntry) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-amber-50/70">
          You're registered{myEntry.team_name ? ` as "${myEntry.team_name}"` : ""}.
        </p>
        {error ? (
          <p role="alert" className="text-sm text-rose-400">
            {error}
          </p>
        ) : null}
        <Button variant="secondary" onClick={handleLeave} disabled={submitting} className="w-fit">
          {submitting ? "Leaving…" : "Leave tournament"}
        </Button>
      </div>
    );
  }

  if (isFull) {
    return <p className="text-sm text-amber-50/60">This tournament is full.</p>;
  }
  if (deadlinePassed) {
    return <p className="text-sm text-amber-50/60">Registration for this tournament has closed.</p>;
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={handleJoin} noValidate>
      {!isAuthenticated ? (
        <label className="flex flex-col gap-1.5 text-sm text-amber-50/70" htmlFor="guest-name">
          Display name
          <input
            id="guest-name"
            type="text"
            className={fieldClasses}
            value={guestName}
            onChange={(event) => setGuestName(event.target.value)}
            placeholder="Registering as a guest"
            required
          />
        </label>
      ) : null}

      <label className="flex flex-col gap-1.5 text-sm text-amber-50/70" htmlFor="nickname">
        In-game nickname <span className="text-amber-50/40">(optional)</span>
        <input
          id="nickname"
          type="text"
          className={fieldClasses}
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm text-amber-50/70" htmlFor="team-name">
        Team name <span className="text-amber-50/40">(optional)</span>
        <input
          id="team-name"
          type="text"
          className={fieldClasses}
          value={teamName}
          onChange={(event) => setTeamName(event.target.value)}
        />
      </label>

      {error ? (
        <p role="alert" className="text-sm text-rose-400">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={submitting} className={`w-fit ${submitting ? "opacity-60" : ""}`}>
        {submitting ? "Registering…" : "Register"}
      </Button>
    </form>
  );
}
