import { Link } from "react-router-dom";
import Section from "../components/layout/Section.jsx";
import SectionHeading from "../components/ui/SectionHeading.jsx";
import Card from "../components/ui/Card.jsx";
import Button from "../components/ui/Button.jsx";
import SpotlightCard from "../components/ui/SpotlightCard.jsx";
import Icon from "../components/ui/Icon.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import { Skeleton, SkeletonCard, SkeletonText } from "../components/ui/Skeleton.jsx";
import { useTcgGames } from "../features/tcg/useTcgGames.js";
import { useDecklists } from "../features/tcg/useDecklists.js";
import { useTrades } from "../features/tcg/useTrades.js";
import { useNews } from "../features/news/useNews.js";
import DecklistCard from "../components/tcg/DecklistCard.jsx";
import TradeListingCard from "../components/tcg/TradeListingCard.jsx";
import NewsListItem from "../components/tcg/NewsListItem.jsx";

// Two genuinely not-yet-built things — no TCG-specific events table exists
// (TOURNAMENTS is scoped to ESPORTS_GAMES only, see Database/schema/
// 007_content_community.sql), and player resources have no backend model at
// all. Shown as a plain roadmap card, never dressed up as live data.
const ROADMAP = [
  {
    title: "TCG events & meetups",
    description: "Local play, prereleases, and community tournaments — planned once event scheduling exists for TCG specifically, separate from RVS Esports.",
  },
  {
    title: "Player resources",
    description: "Rulebooks, deck-building guides, and format primers per game.",
  },
];

export default function TcgPage() {
  const { games, status: gamesStatus } = useTcgGames();
  const activeGames = games.filter((g) => !g.status || g.status === "active");

  const { decklists, status: decksStatus } = useDecklists();
  const featuredDecks = decklists.slice(0, 6);

  const { listings, status: tradesStatus } = useTrades({ limit: 6 });

  const { articles, status: newsStatus } = useNews({ limit: 4 });

  return (
    <>
      <Section spacing="lg" className="pt-14 sm:pt-20">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <SectionHeading
            eyebrow="TCG Community"
            title="Trading card games"
            description="NanashiCollectibles is built as a hub for multiple card games, not one franchise — singles, decklists, trading, and news, organized per game as the catalogue and community grow."
          />
          <div className="flex flex-wrap gap-3">
            <Button to="/shop">Browse singles & sealed</Button>
            <Button to="/contact" variant="secondary">
              Suggest a game
            </Button>
          </div>
        </div>
      </Section>

      <Section tone="muted" spacing="md" containerSize="xwide">
        <SectionHeading size="section" title="Supported games" description="Live from the catalog — updates automatically as games are added." />
        <div className="mt-6">
          {gamesStatus === "loading" ? (
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          ) : gamesStatus === "error" || activeGames.length === 0 ? (
            <EmptyState title="No games available yet" description="Supported trading card games will appear here once added to the catalog." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {activeGames.map((game) => (
                <SpotlightCard key={game.id} as={Link} to={`/shop?game=${game.id}`} className="flex flex-col items-start gap-3 p-5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-gold-300">
                    <Icon name="cards" className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold leading-snug text-amber-50">{game.name}</h3>
                    <p className="mt-1 text-xs text-amber-50/45">Browse singles</p>
                  </div>
                </SpotlightCard>
              ))}
            </div>
          )}
        </div>
      </Section>

      <Section spacing="md" containerSize="xwide">
        <SectionHeading size="section" eyebrow="Decklists" title="From the community" description="Real decklists published to the platform, ranked by relevance." />
        <div className="mt-6">
          {decksStatus === "loading" ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }, (_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : decksStatus === "error" || featuredDecks.length === 0 ? (
            <EmptyState
              title="No decklists published yet"
              description="Community decklists will appear here once they're added to the platform."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featuredDecks.map((deck) => (
                <DecklistCard key={deck.id} deck={deck} />
              ))}
            </div>
          )}
        </div>
      </Section>

      <Section tone="muted" spacing="md" containerSize="xwide">
        <SectionHeading
          size="section"
          eyebrow="Community"
          title="Trading & sale listings"
          description="Active listings posted by the community."
        />
        <div className="mt-6">
          {tradesStatus === "loading" ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }, (_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : tradesStatus === "error" || listings.length === 0 ? (
            <EmptyState
              title="No active listings"
              description="Trade and sale listings from the community will show up here."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((listing) => (
                <TradeListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          )}
        </div>
      </Section>

      <Section spacing="md" containerSize="xwide">
        <SectionHeading size="section" eyebrow="News" title="Recent news" />
        <div className="mt-6">
          {newsStatus === "loading" ? (
            <SkeletonText lines={4} />
          ) : newsStatus === "error" || articles.length === 0 ? (
            <EmptyState title="No news yet" description="Platform announcements and game-specific news will appear here." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {articles.map((article) => (
                <NewsListItem key={article.id} article={article} />
              ))}
            </div>
          )}
        </div>
      </Section>

      <Section tone="muted" spacing="md" className="pb-24">
        <SectionHeading size="section" title="Coming soon" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {ROADMAP.map((item) => (
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
