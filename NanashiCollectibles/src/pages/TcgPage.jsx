import Section from "../components/layout/Section.jsx";
import SectionHeading from "../components/ui/SectionHeading.jsx";
import Card from "../components/ui/Card.jsx";
import Badge from "../components/ui/Badge.jsx";
import { tcgGames } from "../config/site.js";

export default function TcgPage() {
  return (
    <Section className="pt-16 sm:pt-24">
      <SectionHeading
        eyebrow="TCG Community"
        title="Trading card games"
        description="NanashiCollectibles is built as a hub for multiple card games, not one franchise. Card singles, decklists, and community events are planned per game."
      />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tcgGames.map((game) => (
          <Card key={game} className="flex items-center justify-between gap-3">
            <h2 className="font-display text-base font-semibold text-amber-50">{game}</h2>
            <Badge tone="gold">Coming soon</Badge>
          </Card>
        ))}
        <Card className="flex items-center justify-between gap-3 border-dashed">
          <h2 className="font-display text-base font-semibold text-amber-50/70">
            More games
          </h2>
          <Badge>Planned</Badge>
        </Card>
      </div>
    </Section>
  );
}
