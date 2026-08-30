import { useState } from "react";
import Button from "../../components/ui/Button.jsx";
import { TextField } from "../../components/ui/Field.jsx";
import { useAuth } from "../auth/AuthContext.js";
import { useSocket } from "../../services/socket/SocketContext.js";
import { joinTournament, leaveTournament } from "./tournamentService.js";

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
          <p role="alert" className="text-sm text-danger-400">
            {error}
          </p>
        ) : null}
        <Button variant="secondary" onClick={handleLeave} isLoading={submitting} className="w-fit">
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
    <TeamJoinForm
      tournament={tournament}
      isAuthenticated={isAuthenticated}
      socket={socket}
      error={error}
      setError={setError}
      submitting={submitting}
      setSubmitting={setSubmitting}
    />
  ) : (
    <IndividualJoinForm
      tournament={tournament}
      isAuthenticated={isAuthenticated}
      socket={socket}
      error={error}
      setError={setError}
      submitting={submitting}
      setSubmitting={setSubmitting}
    />
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
        <TextField
          id="guest-name"
          label="Display name"
          value={guestName}
          onChange={(event) => setGuestName(event.target.value)}
          placeholder="Registering as a guest"
          required
        />
      ) : null}

      <TextField
        id="nickname"
        label="In-game nickname"
        hint="Optional"
        value={nickname}
        onChange={(event) => setNickname(event.target.value)}
      />

      {error ? (
        <p role="alert" className="text-sm text-danger-400">
          {error}
        </p>
      ) : null}

      <Button type="submit" isLoading={submitting} className="w-fit">
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
      <p className="text-xs text-amber-50/55">Teams of exactly {teamSize} for this tournament.</p>

      <TextField
        id="team-name"
        label="Team name"
        value={teamName}
        onChange={(event) => setTeamName(event.target.value)}
        required
      />

      <div className="flex flex-col gap-3 rounded-lg border border-white/10 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-50/45">You</p>
        {!isAuthenticated ? (
          <TextField
            id="captain-guest-name"
            label="Display name"
            value={guestName}
            onChange={(event) => setGuestName(event.target.value)}
            placeholder="Registering as a guest"
            required
          />
        ) : null}
        <TextField
          id="captain-nickname"
          label="In-game nickname"
          hint="Optional"
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
        />
      </div>

      {teammates.map((m, i) => (
        <div key={i} className="flex flex-col gap-3 rounded-lg border border-white/10 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-50/45">Teammate {i + 1}</p>
          <TextField
            id={`teammate-${i}-name`}
            label="Display name"
            value={m.guestName}
            onChange={(event) => updateTeammate(i, "guestName", event.target.value)}
            required
          />
          <TextField
            id={`teammate-${i}-nickname`}
            label="In-game nickname"
            hint="Optional"
            value={m.nickname}
            onChange={(event) => updateTeammate(i, "nickname", event.target.value)}
          />
        </div>
      ))}

      {error ? (
        <p role="alert" className="text-sm text-danger-400">
          {error}
        </p>
      ) : null}

      <Button type="submit" isLoading={submitting} className="w-fit">
        {submitting ? "Registering…" : "Register team"}
      </Button>
    </form>
  );
}
