import Section from "../components/layout/Section.jsx";
import SectionHeading from "../components/ui/SectionHeading.jsx";
import Card from "../components/ui/Card.jsx";
import Badge from "../components/ui/Badge.jsx";
import Button from "../components/ui/Button.jsx";
import TournamentCard from "../features/tournament/TournamentCard.jsx";
import { useTournaments } from "../features/tournament/useTournaments.js";

function UpcomingTournaments() {
  const { status, tournaments, socketStatus } = useTournaments();
  const isLoading = socketStatus === "connecting" || (socketStatus === "connected" && status === "loading");

  if (socketStatus === "error") {
    return (
      <Card className="text-sm text-amber-50/60">
        Couldn't connect to the tournament server right now.
      </Card>
    );
  }
  if (isLoading) {
    return <Card className="text-sm text-amber-50/60">Loading tournaments…</Card>;
  }
  if (tournaments.length === 0) {
    return (
      <Card className="text-sm text-amber-50/60">
        No tournaments are open right now — check back soon.
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tournaments.slice(0, 3).map((tournament) => (
        <TournamentCard key={tournament.id} tournament={tournament} />
      ))}
    </div>
  );
}

export default function EsportsPage() {
  return (
    <Section className="pt-16 sm:pt-24">
      <SectionHeading
        eyebrow="RVS Esports"
        title="Tournament registration and results"
        description="RVS Esports runs tournament registration for the NanashiCollectibles community — starting with RVS Apex Legends, and built to support more games and events over time."
      />

      <div className="mt-10 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-amber-50">Open tournaments</h2>
          <Button to="/esports/tournaments" variant="secondary" size="md">
            View all tournaments
          </Button>
        </div>
        <UpcomingTournaments />
      </div>

      <Card className="mt-10 flex flex-col gap-3 p-8">
        <Badge tone="gold" className="w-fit">
          Future games
        </Badge>
        <h2 className="font-display text-xl font-semibold text-amber-50">More than Apex Legends</h2>
        <p className="max-w-xl text-sm text-amber-50/60">
          The tournament system isn't built around any one game — new titles and events will
          appear here as they're organized.
        </p>
      </Card>
    </Section>
  );
}
