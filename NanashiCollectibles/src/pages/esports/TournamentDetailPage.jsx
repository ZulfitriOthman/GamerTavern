import { Link, useParams } from "react-router-dom";
import Section from "../../components/layout/Section.jsx";
import Card from "../../components/ui/Card.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import TournamentRegistrationForm from "../../features/tournament/TournamentRegistrationForm.jsx";
import { useTournaments } from "../../features/tournament/useTournaments.js";
import { formatDateTime, formatEntryFee } from "../../features/tournament/format.js";

// closed/completed are informational, not urgent — neutral. cancelled is a real
// negative outcome — danger. open is the one live/actionable state — signal.
const STATUS_BADGES = {
  draft: { label: "Draft", tone: "neutral" },
  open: { label: "Open", tone: "signal" },
  closed: { label: "Closed", tone: "neutral" },
  completed: { label: "Completed", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "danger" },
};

export default function TournamentDetailPage() {
  const { id } = useParams();
  const { status, tournaments, error, socketStatus, refresh } = useTournaments();

  const isLoading = socketStatus === "connecting" || (socketStatus === "connected" && status === "loading");
  const tournament = tournaments.find((t) => String(t.id) === id);

  if (socketStatus === "error") {
    return (
      <Section spacing="lg" className="pt-14 sm:pt-20">
        <Card className="flex flex-col items-start gap-3">
          <p className="text-sm text-amber-50/70">Couldn't connect to the tournament server.</p>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </Card>
      </Section>
    );
  }

  if (isLoading) {
    return (
      <Section spacing="lg" className="pt-14 sm:pt-20">
        <Card className="text-sm text-amber-50/60">Loading tournament…</Card>
      </Section>
    );
  }

  if (status === "error") {
    return (
      <Section spacing="lg" className="pt-14 sm:pt-20">
        <Card className="flex flex-col items-start gap-3">
          <p className="text-sm text-amber-50/70">{error}</p>
          <Button variant="secondary" onClick={refresh}>
            Try again
          </Button>
        </Card>
      </Section>
    );
  }

  if (!tournament) {
    return (
      <Section spacing="lg" className="pt-14 sm:pt-20">
        <Card className="flex flex-col items-start gap-3">
          <p className="text-sm text-amber-50/70">This tournament couldn't be found.</p>
          <Button to="/esports/tournaments" variant="secondary">
            Back to tournaments
          </Button>
        </Card>
      </Section>
    );
  }

  const statusBadge = STATUS_BADGES[tournament.status] ?? null;
  const isTeamMode = tournament.registration_type === "team";
  const isRegistrationOpen = tournament.status === "open";

  const entryCount = isTeamMode ? tournament.teams?.length || 0 : tournament.participants?.length || 0;
  const capacityLabel =
    tournament.max_entries != null
      ? `${entryCount}/${tournament.max_entries} ${isTeamMode ? "teams" : "registered"}`
      : null;

  // A single scannable line answering "is this open, when, what type, how full" —
  // before the reader has to parse the full detail grid below.
  const quickFacts = [
    statusBadge?.label,
    formatDateTime(tournament.start_date),
    isTeamMode ? `Team of ${tournament.team_size}` : "Individual",
    capacityLabel,
  ].filter(Boolean);

  return (
    <Section spacing="lg" className="pt-14 sm:pt-20">
      <Link to="/esports/tournaments" className="rounded text-sm text-amber-50/50 hover:text-amber-50 focus-ring">
        ← All tournaments
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {tournament.esports_game_name ? <Badge tone="signal">{tournament.esports_game_name}</Badge> : null}
        {statusBadge ? <Badge tone={statusBadge.tone}>{statusBadge.label}</Badge> : null}
        {isTeamMode ? <Badge>Team tournament</Badge> : null}
      </div>

      <h1 className="mt-3 font-display text-3xl font-semibold text-amber-50 sm:text-4xl">{tournament.name}</h1>

      {tournament.description ? (
        <p className="mt-3 max-w-2xl text-base text-amber-50/70">{tournament.description}</p>
      ) : null}

      {quickFacts.length > 0 ? (
        <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-amber-50/55">
          {quickFacts.map((fact, i) => (
            <span key={fact} className="flex items-center gap-2">
              {i > 0 ? <span aria-hidden="true" className="text-amber-50/25">·</span> : null}
              {fact}
            </span>
          ))}
        </p>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-3 lg:items-start">
        <Card variant="data" className="lg:col-span-2">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
            {formatDateTime(tournament.start_date) ? (
              <div>
                <dt className="text-xs uppercase tracking-wide text-amber-50/45">Starts</dt>
                <dd className="mt-1 text-amber-50/80">{formatDateTime(tournament.start_date)}</dd>
              </div>
            ) : null}
            {formatDateTime(tournament.end_date) ? (
              <div>
                <dt className="text-xs uppercase tracking-wide text-amber-50/45">Ends</dt>
                <dd className="mt-1 text-amber-50/80">{formatDateTime(tournament.end_date)}</dd>
              </div>
            ) : null}
            {tournament.location ? (
              <div>
                <dt className="text-xs uppercase tracking-wide text-amber-50/45">Location</dt>
                <dd className="mt-1 text-amber-50/80">{tournament.location}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-xs uppercase tracking-wide text-amber-50/45">Entry fee</dt>
              <dd className="mt-1 text-amber-50/80">{formatEntryFee(tournament.entry_fee)}</dd>
            </div>
            {isTeamMode ? (
              <div>
                <dt className="text-xs uppercase tracking-wide text-amber-50/45">Team size</dt>
                <dd className="mt-1 text-amber-50/80">{tournament.team_size} players</dd>
              </div>
            ) : null}
            {capacityLabel ? (
              <div>
                <dt className="text-xs uppercase tracking-wide text-amber-50/45">Capacity</dt>
                <dd className="mt-1 text-amber-50/80">{capacityLabel}</dd>
              </div>
            ) : null}
            {formatDateTime(tournament.registration_deadline) ? (
              <div>
                <dt className="text-xs uppercase tracking-wide text-amber-50/45">Registration deadline</dt>
                <dd className="mt-1 text-amber-50/80">{formatDateTime(tournament.registration_deadline)}</dd>
              </div>
            ) : null}
            {tournament.organizer ? (
              <div>
                <dt className="text-xs uppercase tracking-wide text-amber-50/45">Organizer</dt>
                <dd className="mt-1 text-amber-50/80">{tournament.organizer}</dd>
              </div>
            ) : null}
          </dl>

          {tournament.rules ? (
            <div className="mt-6 border-t border-white/10 pt-6">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-amber-50/55">Rules</h2>
              <p className="mt-3 whitespace-pre-line text-sm text-amber-50/70">{tournament.rules}</p>
            </div>
          ) : null}

          {isTeamMode ? (
            tournament.teams?.length ? (
              <div className="mt-6 border-t border-white/10 pt-6">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-amber-50/55">
                  Registered teams ({tournament.teams.length})
                </h2>
                <ul className="mt-3 flex flex-col gap-3 text-sm text-amber-50/70">
                  {tournament.teams.map((team) => (
                    <li key={team.id}>
                      <p className="font-medium text-amber-50">{team.name}</p>
                      <p className="text-xs text-amber-50/50">
                        {(team.members || [])
                          .map((m) => m.nickname || m.user_name || m.guest_name || "Anonymous")
                          .join(", ")}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null
          ) : tournament.participants?.length ? (
            <div className="mt-6 border-t border-white/10 pt-6">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-amber-50/55">
                Registered ({tournament.participants.length})
              </h2>
              <ul className="mt-3 flex flex-col gap-1.5 text-sm text-amber-50/70">
                {tournament.participants.map((p) => (
                  <li key={p.id}>
                    {p.nickname || p.user_name || p.guest_name || "Anonymous"}
                    {p.user_role === "GUEST" ? <span className="ml-2 text-xs text-amber-50/45">guest</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>

        {/* Elevated only while registration is actually actionable — the card
            shouldn't compete for attention once there's nothing to do here. */}
        <Card variant={isRegistrationOpen ? "elevated" : "default"}>
          <h2 className="font-display text-lg font-semibold text-amber-50">Registration</h2>
          <div className="mt-4">
            <TournamentRegistrationForm tournament={tournament} />
          </div>
        </Card>
      </div>
    </Section>
  );
}
