import Section from "../components/layout/Section.jsx";
import SectionHeading from "../components/ui/SectionHeading.jsx";
import Card from "../components/ui/Card.jsx";
import Badge from "../components/ui/Badge.jsx";
import { tcgGames } from "../config/site.js";

const DIRECTIONS = [
  {
    title: "Singles & sealed",
    description: "Individual cards and sealed product, organized by game as the catalogue grows.",
  },
  {
    title: "Decklists",
    description: "A place to publish and browse decklists per game, not locked to one franchise.",
  },
  {
    title: "Community events",
    description: "Local play and trading events, planned alongside the games our community already plays.",
  },
];

export default function TcgPage() {
  return (
    <>
      <Section spacing="lg" className="pt-14 sm:pt-20">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <SectionHeading
            eyebrow="TCG Community"
            title="Trading card games"
            description="NanashiCollectibles is built as a hub for multiple card games, not one franchise. Card singles, decklists, and community events are planned per game."
          />
          <Card className="flex flex-wrap gap-2.5">
            {tcgGames.map((game) => (
              <Badge key={game} tone="gold" className="px-4 py-2 text-sm">
                {game}
              </Badge>
            ))}
            <Badge className="px-4 py-2 text-sm">More games coming</Badge>
          </Card>
        </div>
      </Section>

      <Section tone="muted" spacing="md" className="pb-24">
        <SectionHeading size="section" title="Where this is headed" />
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {DIRECTIONS.map((item) => (
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
