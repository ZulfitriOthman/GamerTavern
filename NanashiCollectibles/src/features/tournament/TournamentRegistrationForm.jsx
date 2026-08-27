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

  const isAuthenticated = authStatus === "authenticated";
  const userId = isAuthenticated ? user.sub : null;
  const isTeamMode = tournament.registration_type === "team";

  const myEntry = isAuthenticated
    ? tournament.participants?.find((p) => String(p.user_id) === String(userId))
    : null;

  // max_entries means max registrants (individual mode) or max teams (team mode) —
  // count against the matching collection either way.
  const entryCount = isTeamMode ? tournament.teams?.length || 0 : tournament.participants?.length || 0;
  const spotsLeft = tournament.max_entries != null ? tournament.max_entries - entryCount : null;
  const isFull = spotsLeft != null && spotsLeft <= 0;
  const deadlinePassed =
    tournament.registration_deadline && new Date(tournament.registration_deadline) < new Date();
  const isClosedForRegistration = tournament.status !== "open";

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleLeave() {
    setError(null);
    setSubmitting(true);
    try {
      await leaveTournament(socket, { tournamentId: tournament.id });
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
    const myTeam = isTeamMode
      ? tournament.teams?.find((t) => t.members?.some((m) => m.id === myEntry.id))
      : null;
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-amber-50/70">
          You're registered{myTeam ? ` as part of "${myTeam.name}"` : ""}.
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

  if (isClosedForRegistration) {
    return <p className="text-sm text-amber-50/60">Registration for this tournament isn't open.</p>;
  }
  if (isFull) {
    return <p className="text-sm text-amber-50/60">This tournament is full.</p>;
  }
  if (deadlinePassed) {
    return <p className="text-sm text-amber-50/60">Registration for this tournament has closed.</p>;
  }

  return isTeamMode ? (
    <TeamJoinForm tournament={tournament} isAuthenticated={isAuthenticated} socket={socket} error={error} setError={setError} submitting={submitting} setSubmitting={setSubmitting} />
  ) : (
    <IndividualJoinForm tournament={tournament} isAuthenticated={isAuthenticated} socket={socket} error={error} setError={setError} submitting={submitting} setSubmitting={setSubmitting} />
  );
}

function IndividualJoinForm({ tournament, isAuthenticated, socket, error, setError, submitting, setSubmitting }) {
  const [guestName, setGuestName] = useState("");
  const [nickname, setNickname] = useState("");

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
        guestName: isAuthenticated ? undefined : guestName.trim(),
        nickname: nickname.trim() || undefined,
      });
      setGuestName("");
      setNickname("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
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

function TeamJoinForm({ tournament, isAuthenticated, socket, error, setError, submitting, setSubmitting }) {
  const teamSize = tournament.team_size || 1;
  const teammateCount = Math.max(teamSize - 1, 0);

  const [teamName, setTeamName] = useState("");
  const [guestName, setGuestName] = useState("");
  const [nickname, setNickname] = useState("");
  const [teammates, setTeammates] = useState(
    Array.from({ length: teammateCount }, () => ({ guestName: "", nickname: "" }))
  );

  function updateTeammate(index, field, value) {
    setTeammates((prev) => prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)));
  }

  async function handleJoin(event) {
    event.preventDefault();
    setError(null);

    if (!teamName.trim()) {
      setError("Enter a team name.");
      return;
    }
    if (!isAuthenticated && !guestName.trim()) {
      setError("Enter a display name to join as a guest.");
      return;
    }
    if (teammates.some((m) => !m.guestName.trim())) {
      setError(`This tournament needs teams of exactly ${teamSize} — enter a display name for every teammate.`);
      return;
    }

    setSubmitting(true);
    try {
      await joinTournament(socket, {
        tournamentId: tournament.id,
        teamName: teamName.trim(),
        guestName: isAuthenticated ? undefined : guestName.trim(),
        nickname: nickname.trim() || undefined,
        teammates: teammates.map((m) => ({ guestName: m.guestName.trim(), nickname: m.nickname.trim() || undefined })),
      });
      setTeamName("");
      setGuestName("");
      setNickname("");
      setTeammates(Array.from({ length: teammateCount }, () => ({ guestName: "", nickname: "" })));
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={handleJoin} noValidate>
      <p className="text-xs text-amber-50/40">Teams of exactly {teamSize} for this tournament.</p>

      <label className="flex flex-col gap-1.5 text-sm text-amber-50/70" htmlFor="team-name">
        Team name
        <input
          id="team-name"
          type="text"
          className={fieldClasses}
          value={teamName}
          onChange={(event) => setTeamName(event.target.value)}
          required
        />
      </label>

      <div className="rounded-lg border border-white/10 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-50/40">You</p>
        {!isAuthenticated ? (
          <label className="flex flex-col gap-1.5 text-sm text-amber-50/70" htmlFor="captain-guest-name">
            Display name
            <input
              id="captain-guest-name"
              type="text"
              className={fieldClasses}
              value={guestName}
              onChange={(event) => setGuestName(event.target.value)}
              placeholder="Registering as a guest"
              required
            />
          </label>
        ) : null}
        <label className="mt-2 flex flex-col gap-1.5 text-sm text-amber-50/70" htmlFor="captain-nickname">
          In-game nickname <span className="text-amber-50/40">(optional)</span>
          <input
            id="captain-nickname"
            type="text"
            className={fieldClasses}
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
          />
        </label>
      </div>

      {teammates.map((m, i) => (
        <div key={i} className="rounded-lg border border-white/10 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-50/40">
            Teammate {i + 1}
          </p>
          <label className="flex flex-col gap-1.5 text-sm text-amber-50/70" htmlFor={`teammate-${i}-name`}>
            Display name
            <input
              id={`teammate-${i}-name`}
              type="text"
              className={fieldClasses}
              value={m.guestName}
              onChange={(event) => updateTeammate(i, "guestName", event.target.value)}
              required
            />
          </label>
          <label className="mt-2 flex flex-col gap-1.5 text-sm text-amber-50/70" htmlFor={`teammate-${i}-nickname`}>
            In-game nickname <span className="text-amber-50/40">(optional)</span>
            <input
              id={`teammate-${i}-nickname`}
              type="text"
              className={fieldClasses}
              value={m.nickname}
              onChange={(event) => updateTeammate(i, "nickname", event.target.value)}
            />
          </label>
        </div>
      ))}

      {error ? (
        <p role="alert" className="text-sm text-rose-400">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={submitting} className={`w-fit ${submitting ? "opacity-60" : ""}`}>
        {submitting ? "Registering…" : "Register team"}
      </Button>
    </form>
  );
}
