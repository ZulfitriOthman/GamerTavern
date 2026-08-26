import { Link } from "react-router-dom";
import Section from "../../components/layout/Section.jsx";
import SectionHeading from "../../components/ui/SectionHeading.jsx";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import TournamentCard from "../../features/tournament/TournamentCard.jsx";
import { useTournaments } from "../../features/tournament/useTournaments.js";

export default function TournamentListPage() {
  const { status, tournaments, error, socketStatus, refresh } = useTournaments();

  const isConnecting = socketStatus === "connecting" || (socketStatus === "connected" && status === "loading");
  const isConnectionFailure = socketStatus === "error";

  return (
    <Section className="pt-16 sm:pt-24">
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
          <Card className="text-sm text-amber-50/60">Loading tournaments…</Card>
        ) : status === "error" ? (
          <Card className="flex flex-col items-start gap-3">
            <p className="text-sm text-amber-50/70">{error}</p>
            <Button variant="secondary" onClick={refresh}>
              Try again
            </Button>
          </Card>
        ) : tournaments.length === 0 ? (
          <Card className="text-sm text-amber-50/60">
            No tournaments are open right now. Check back soon, or watch{" "}
            <Link to="/esports" className="text-brand-400 hover:text-brand-300">
              RVS Esports
            </Link>{" "}
            for announcements.
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tournaments.map((tournament) => (
              <TournamentCard key={tournament.id} tournament={tournament} />
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}
