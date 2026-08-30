import Section from "../components/layout/Section.jsx";
import SectionHeading from "../components/ui/SectionHeading.jsx";
import Card from "../components/ui/Card.jsx";
import Button from "../components/ui/Button.jsx";
import { SkeletonCard } from "../components/ui/Skeleton.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import TournamentCard from "../features/tournament/TournamentCard.jsx";
import { useTournaments } from "../features/tournament/useTournaments.js";

// Describes the actual, currently-working registration mechanics — not marketing
// copy — verified against TournamentRegistrationForm.jsx and the backend contract.
const REGISTRATION_INFO = [
  {
    title: "Individual registration",
    description: "Join solo tournaments with an account or as a guest — no team required.",
  },
  {
    title: "Team registration",
    description: "One captain registers the full roster in a single submission — guests can fill teammate slots.",
  },
  {
    title: "Live capacity",
    description: "Spots and team counts update in real time as other players register.",
  },
];

function TournamentsGrid() {
  const { status, tournaments, error, socketStatus, refresh } = useTournaments();
  const isLoading = socketStatus === "connecting" || (socketStatus === "connected" && status === "loading");
  const hasError = socketStatus === "error" || status === "error";

  if (hasError) {
    return (
      <Card className="flex flex-col items-start gap-3">
        <p className="text-sm text-amber-50/70">
          {socketStatus === "error" ? "Couldn't connect to the tournament server." : error}
        </p>
        <Button variant="secondary" onClick={socketStatus === "error" ? () => window.location.reload() : refresh}>
          Try again
        </Button>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard className="hidden sm:block" />
        <SkeletonCard className="hidden lg:block" />
      </div>
    );
  }

  if (tournaments.length === 0) {
    return (
      <EmptyState
        title="No tournaments are scheduled right now"
        description="New RVS Esports tournaments are announced here as soon as they're open for registration."
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tournaments.map((tournament) => (
        <TournamentCard key={tournament.id} tournament={tournament} />
      ))}
    </div>
  );
}

export default function EsportsPage() {
  return (
    <>
      <Section spacing="lg" className="pt-14 sm:pt-20">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            eyebrow="RVS Esports"
            title="Tournament registration and results"
            description="RVS Esports runs tournament registration for the NanashiCollectibles community — starting with Apex Legends, and built to support more games and events over time."
            className="max-w-2xl"
          />
          <Button to="/esports/tournaments" size="lg" className="shrink-0">
            Browse all tournaments
          </Button>
        </div>
      </Section>

      <Section tone="muted" spacing="md">
        <SectionHeading size="section" title="Tournaments" />
        <div className="mt-6">
          <TournamentsGrid />
        </div>
      </Section>

      <Section spacing="md" className="pb-24">
        <SectionHeading size="section" title="How registration works" />
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {REGISTRATION_INFO.map((item) => (
            <Card key={item.title}>
              <h3 className="font-display text-base font-semibold text-amber-50">{item.title}</h3>
              <p className="mt-2 text-sm text-amber-50/60">{item.description}</p>
            </Card>
          ))}
        </div>
      </Section>
    </>
  );
}
