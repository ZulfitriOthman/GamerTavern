import Section from "../../components/layout/Section.jsx";
import SectionHeading from "../../components/ui/SectionHeading.jsx";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import { SkeletonCard } from "../../components/ui/Skeleton.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import TournamentCard from "../../features/tournament/TournamentCard.jsx";
import { useTournaments } from "../../features/tournament/useTournaments.js";

// Open tournaments first — a presentation-only ordering, no new backend logic.
const STATUS_ORDER = { open: 0, draft: 1, closed: 2, completed: 3, cancelled: 4 };

export default function TournamentListPage() {
  const { status, tournaments, error, socketStatus, refresh } = useTournaments();

  const isConnecting = socketStatus === "connecting" || (socketStatus === "connected" && status === "loading");
  const isConnectionFailure = socketStatus === "error";

  const sorted = [...tournaments].sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99)
  );

  return (
    <Section spacing="lg" className="pt-14 sm:pt-20">
      <SectionHeading
        eyebrow="RVS Esports"
        title="Tournaments"
        description="Live tournament listings, connected to the RVS tournament backend."
      />

      <div className="mt-10">
        {isConnectionFailure ? (
          <Card className="flex flex-col items-start gap-3">
            <p className="text-sm text-amber-50/70">
              Couldn't connect to the tournament server. Check your connection and try again.
            </p>
            <Button variant="secondary" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </Card>
        ) : isConnecting ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SkeletonCard />
            <SkeletonCard className="hidden sm:block" />
            <SkeletonCard className="hidden lg:block" />
          </div>
        ) : status === "error" ? (
          <Card className="flex flex-col items-start gap-3">
            <p className="text-sm text-amber-50/70">{error}</p>
            <Button variant="secondary" onClick={refresh}>
              Try again
            </Button>
          </Card>
        ) : tournaments.length === 0 ? (
          <EmptyState
            title="No tournaments are open right now"
            description="Check back soon, or watch RVS Esports for announcements."
            action={
              <Button to="/esports" variant="secondary" size="md">
                View RVS Esports
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.map((tournament) => (
              <TournamentCard key={tournament.id} tournament={tournament} />
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}
