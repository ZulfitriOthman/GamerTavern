import { Link, useParams } from "react-router-dom";
import Section from "../../components/layout/Section.jsx";
import Card from "../../components/ui/Card.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import TournamentRegistrationForm from "../../features/tournament/TournamentRegistrationForm.jsx";
import { useTournaments } from "../../features/tournament/useTournaments.js";
import { formatDateTime, formatEntryFee } from "../../features/tournament/format.js";

// Derived client-side only, from real start/end dates — the backend has no status field.
function deriveStatus(tournament) {
  const now = new Date();
  const start = tournament.start_date ? new Date(tournament.start_date) : null;
  const end = tournament.end_date ? new Date(tournament.end_date) : start;
  if (start && now < start) return { label: "Upcoming", tone: "signal" };
  if (end && now > end) return { label: "Completed", tone: "neutral" };
  if (start) return { label: "In progress", tone: "gold" };
  return null;
}

export default function TournamentDetailPage() {
  const { id } = useParams();
  const { status, tournaments, error, socketStatus, refresh } = useTournaments();

  const isLoading = socketStatus === "connecting" || (socketStatus === "connected" && status === "loading");
  const tournament = tournaments.find((t) => String(t.id) === id);

  if (socketStatus === "error") {
    return (
      <Section className="pt-16 sm:pt-24">
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
      <Section className="pt-16 sm:pt-24">
        <Card className="text-sm text-amber-50/60">Loading tournament…</Card>
      </Section>
    );
  }

  if (status === "error") {
    return (
      <Section className="pt-16 sm:pt-24">
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
      <Section className="pt-16 sm:pt-24">
        <Card className="flex flex-col items-start gap-3">
          <p className="text-sm text-amber-50/70">This tournament couldn't be found.</p>
          <Button to="/esports/tournaments" variant="secondary">
            Back to tournaments
          </Button>
        </Card>
      </Section>
    );
  }

  const derivedStatus = deriveStatus(tournament);

  return (
    <Section className="pt-16 sm:pt-24">
      <Link to="/esports/tournaments" className="text-sm text-amber-50/50 hover:text-amber-50">
        ← All tournaments
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {tournament.game_title ? <Badge tone="signal">{tournament.game_title}</Badge> : null}
        {derivedStatus ? <Badge tone={derivedStatus.tone}>{derivedStatus.label}</Badge> : null}
      </div>

      <h1 className="mt-3 font-display text-3xl font-semibold text-amber-50 sm:text-4xl">
        {tournament.name}
      </h1>

      {tournament.description ? (
        <p className="mt-3 max-w-2xl text-base text-amber-50/70">{tournament.description}</p>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
            {formatDateTime(tournament.start_date) ? (
              <div>
                <dt className="text-xs uppercase tracking-wide text-amber-50/30">Starts</dt>
                <dd className="mt-1 text-amber-50/80">{formatDateTime(tournament.start_date)}</dd>
              </div>
            ) : null}
            {formatDateTime(tournament.end_date) ? (
              <div>
                <dt className="text-xs uppercase tracking-wide text-amber-50/30">Ends</dt>
                <dd className="mt-1 text-amber-50/80">{formatDateTime(tournament.end_date)}</dd>
              </div>
            ) : null}
            {tournament.location ? (
              <div>
                <dt className="text-xs uppercase tracking-wide text-amber-50/30">Location</dt>
                <dd className="mt-1 text-amber-50/80">{tournament.location}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-xs uppercase tracking-wide text-amber-50/30">Entry fee</dt>
              <dd className="mt-1 text-amber-50/80">{formatEntryFee(tournament.entry_fee)}</dd>
            </div>
            {tournament.max_teams != null ? (
              <div>
                <dt className="text-xs uppercase tracking-wide text-amber-50/30">Capacity</dt>
                <dd className="mt-1 text-amber-50/80">
                  {tournament.participants?.length || 0} / {tournament.max_teams} registered
                </dd>
              </div>
            ) : null}
            {formatDateTime(tournament.registration_deadline) ? (
              <div>
                <dt className="text-xs uppercase tracking-wide text-amber-50/30">
                  Registration deadline
                </dt>
                <dd className="mt-1 text-amber-50/80">
                  {formatDateTime(tournament.registration_deadline)}
                </dd>
              </div>
            ) : null}
            {tournament.organizer ? (
              <div>
                <dt className="text-xs uppercase tracking-wide text-amber-50/30">Organizer</dt>
                <dd className="mt-1 text-amber-50/80">{tournament.organizer}</dd>
              </div>
            ) : null}
          </dl>

          {tournament.rules ? (
            <div className="mt-6 border-t border-white/10 pt-6">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-amber-50/40">Rules</h2>
              <p className="mt-3 whitespace-pre-line text-sm text-amber-50/70">{tournament.rules}</p>
            </div>
          ) : null}

          {tournament.participants?.length ? (
            <div className="mt-6 border-t border-white/10 pt-6">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-amber-50/40">
                Registered ({tournament.participants.length})
              </h2>
              <ul className="mt-3 flex flex-col gap-1.5 text-sm text-amber-50/70">
                {tournament.participants.map((p) => (
                  <li key={p.id}>
                    {p.team_name || p.nickname || p.user_name || p.guest_name || "Anonymous"}
                    {p.user_role === "GUEST" ? (
                      <span className="ml-2 text-xs text-amber-50/30">guest</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>

        <Card>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-amber-50/40">
            Registration
          </h2>
          <div className="mt-4">
            <TournamentRegistrationForm tournament={tournament} />
          </div>
        </Card>
      </div>
    </Section>
  );
}
