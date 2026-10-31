import { Link } from "react-router-dom";
import Section from "../../components/layout/Section.jsx";
import SectionHeading from "../../components/ui/SectionHeading.jsx";
import Button from "../../components/ui/Button.jsx";
import SpotlightCard from "../../components/ui/SpotlightCard.jsx";
import BlurFade from "../../components/ui/BlurFade.jsx";
import Icon from "../../components/ui/Icon.jsx";
import { Skeleton } from "../../components/ui/Skeleton.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import { useTcgGames } from "../../features/tcg/useTcgGames.js";

// Live tcg_games (Backend/controllers/tcgcategories.controller.js) — replaces
// the previous static config['tcgGames'] chip row with the actual supported-game
// list, so this grid can never drift out of sync with what the catalog supports.
export default function TcgSection() {
  const { games, status } = useTcgGames();
  const activeGames = games.filter((g) => !g.status || g.status === "active");

  return (
    <Section spacing="md" containerSize="xwide">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
        <BlurFade inView className="max-w-xl">
          <SectionHeading
            size="section"
            eyebrow="TCG Community"
            title="Built for the games you already play"
            description="Card singles, decklists, and events, organized by game — not locked to one franchise."
          />
        </BlurFade>
        <Button to="/tcg" variant="secondary" className="w-fit shrink-0">
          Visit the TCG hub
        </Button>
      </div>

      <div className="mt-8">
        {status === "loading" ? (
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : status === "error" || activeGames.length === 0 ? (
          <EmptyState
            title="Supported games are loading"
            description="The list of supported trading card games comes from the live catalog."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {activeGames.map((game) => (
              <SpotlightCard key={game.id} as={Link} to="/tcg" className="flex flex-col items-start gap-3 p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-gold-300">
                  <Icon name="cards" className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold leading-snug text-amber-50">{game.name}</h3>
                  <p className="mt-1 text-xs text-amber-50/45">Trading Card Game</p>
                </div>
              </SpotlightCard>
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}
