import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Section from "../components/layout/Section.jsx";
import SectionHeading from "../components/ui/SectionHeading.jsx";
import Card from "../components/ui/Card.jsx";
import Badge from "../components/ui/Badge.jsx";
import Button from "../components/ui/Button.jsx";
import BlurFade from "../components/ui/BlurFade.jsx";
import SpotlightCard from "../components/ui/SpotlightCard.jsx";
import { SkeletonCard } from "../components/ui/Skeleton.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import { BlackHoleHeroSection } from "../components/ui/BlackHoleHeroSection.jsx";
import TournamentCard from "../features/tournament/TournamentCard.jsx";
import { useTournaments } from "../features/tournament/useTournaments.js";
import { services, shopCategories, site, tcgGames } from "../config/site.js";

// Mirrors the reference demo's own responsive hook — narrow enough to be
// homepage-local rather than a new shared primitive for a single call site.
function useNarrowViewport(query = "(max-width: 767px)") {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const sync = () => setNarrow(mql.matches);
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, [query]);
  return narrow;
}

// Cinematic hero: the WebGL renderer occupies the full-bleed background, the
// reading copy sits inside its own directional scrim rather than under a flat
// dark overlay. Colors are pulled from Nanashi's own brand/ink tokens (no new
// hex values invented) so the piece reads as abstract brand motion — "giving
// form to possibility" — rather than a literal astrophysics illustration.
function Hero() {
  const narrow = useNarrowViewport();

  return (
    <section className="relative min-h-[92svh] w-full md:min-h-[720px]">
      <BlackHoleHeroSection
        focus={narrow ? [0.5, 0.78] : [0.72, 0.46]}
        scrim={narrow ? "top" : "left"}
        scrimStrength={0.85}
        distance={24}
        elevation={narrow ? -7 : -5.5}
        roll={-20}
        fov={narrow ? 58 : 42}
        diskDensity={1.1}
        doppler={0.15}
        hotColor="#F4F1FF"
        midColor="#6C56E8"
        coolColor="#241C4A"
        glow={narrow ? 0.8 : 0.9}
        exposure={0.9}
        vignette={0.3}
        steps={narrow ? 165 : 240}
        resolution={narrow ? 0.55 : 0.68}
        maxDpr={narrow ? 1 : 1.5}
      >
        <div className="flex h-full min-h-[92svh] items-start px-4 pt-16 sm:px-6 sm:pt-20 md:min-h-[720px] md:items-center md:pt-0 lg:px-8">
          <div className="max-w-xl">
            <BlurFade delay={0}>
              <Badge tone="signal">{site.name}</Badge>
            </BlurFade>

            <BlurFade delay={0.08}>
              <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.05] tracking-tight text-amber-50 sm:text-6xl lg:text-7xl">
                Giving form to <span className="text-brand-400">possibility.</span>
              </h1>
            </BlurFade>

            <BlurFade delay={0.16}>
              <p className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold uppercase tracking-[0.2em] text-brand-400">
                <span>Idea</span>
                <span aria-hidden="true" className="text-amber-50/30">
                  →
                </span>
                <span>Structure</span>
                <span aria-hidden="true" className="text-amber-50/30">
                  →
                </span>
                <span>Outcome</span>
              </p>
            </BlurFade>

            <BlurFade delay={0.24}>
              <p className="mt-5 max-w-lg text-base text-amber-50/70 sm:text-lg">{site.description}</p>
            </BlurFade>

            <BlurFade delay={0.32}>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button to="/about" size="lg">
                  Explore Nanashi
                </Button>
                <Button to="/services" variant="secondary" size="lg">
                  Our Services
                </Button>
              </div>
            </BlurFade>
          </div>
        </div>
      </BlackHoleHeroSection>
    </section>
  );
}

// Asymmetric bento: on desktop a 5-column track gives Shop/Services a 3-column
// footprint and RVS Esports/TCG a 2-column footprint, alternating per row —
// diagonally "larger" without needing row-spans. Tablet/mobile collapse to an
// even 2-col / 1-col grid rather than forcing the same asymmetry down.
function ExploreNanashi() {
  const shopPreview = shopCategories.slice(0, 3).map((category) => category.name);
  const servicePreview = services.map((service) => service.name);

  return (
    <Section spacing="md">
      <BlurFade inView>
        <SectionHeading
          size="section"
          eyebrow="Explore Nanashi"
          title="One platform, several capabilities"
          description="Nanashi is built to grow across commerce, competition, and craft — not to stay a single niche."
        />
      </BlurFade>

      <div className="mt-8 grid gap-4 lg:grid-cols-5">
        <SpotlightCard
          as={Link}
          to="/shop"
          className="flex h-full flex-col justify-between gap-6 lg:col-span-3"
        >
          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-signal-400">01</span>
            <h3 className="font-display text-2xl font-semibold text-amber-50">Shop</h3>
            <p className="max-w-md text-sm text-amber-50/65">
              Trading cards, collectibles, technology and commerce.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {shopPreview.map((name) => (
              <Badge key={name} className="text-xs">
                {name}
              </Badge>
            ))}
          </div>
        </SpotlightCard>

        <SpotlightCard
          as={Link}
          to="/esports"
          className="flex h-full flex-col justify-between gap-6 lg:col-span-2"
        >
          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-signal-400">02</span>
            <h3 className="font-display text-xl font-semibold text-amber-50">RVS Esports</h3>
            <p className="text-sm text-amber-50/65">
              Tournament infrastructure, communities and competitive events.
            </p>
          </div>
          <span aria-hidden="true" className="text-amber-50/30">
            →
          </span>
        </SpotlightCard>

        <SpotlightCard
          as={Link}
          to="/services"
          className="flex h-full flex-col justify-between gap-6 lg:col-span-3"
        >
          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-signal-400">03</span>
            <h3 className="font-display text-2xl font-semibold text-amber-50">Services</h3>
            <p className="max-w-md text-sm text-amber-50/65">
              Drone, website and application development.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {servicePreview.map((name) => (
              <Badge key={name} className="text-xs">
                {name}
              </Badge>
            ))}
          </div>
        </SpotlightCard>

        <SpotlightCard
          as={Link}
          to="/tcg"
          className="flex h-full flex-col justify-between gap-6 lg:col-span-2"
        >
          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-signal-400">04</span>
            <h3 className="font-display text-xl font-semibold text-amber-50">TCG Community</h3>
            <p className="text-sm text-amber-50/65">Games, cards, events and communities.</p>
          </div>
          <span aria-hidden="true" className="text-amber-50/30">
            →
          </span>
        </SpotlightCard>
      </div>
    </Section>
  );
}

// The one vertical with a real, live backend behind it — given the strongest
// homepage treatment (elevated banner + real data) because it's the only part
// of the platform that's actually functional beyond a placeholder right now.
function EsportsSpotlight() {
  const { status, tournaments, socketStatus, error } = useTournaments();
  const isLoading = socketStatus === "connecting" || (socketStatus === "connected" && status === "loading");
  const hasError = socketStatus === "error" || status === "error";
  const openTournaments = tournaments.filter((t) => t.status === "open").slice(0, 3);

  // Visitors get a generic promotional fallback below — this keeps the failure
  // visible in devtools without exposing backend/socket details publicly.
  useEffect(() => {
    if (hasError) {
      console.error("Tournament feed unavailable:", error || "socket connection error");
    }
  }, [hasError, error]);

  return (
    <Section tone="muted" spacing="lg">
      <div className="flex flex-col gap-8">
        {hasError ? (
          <Card variant="elevated" className="flex flex-col items-start gap-3">
            <Badge tone="signal">RVS Esports</Badge>
            <h2 className="font-display text-xl font-semibold text-amber-50 sm:text-2xl">
              Tournament registration and competitive events
            </h2>
            <p className="max-w-xl text-sm text-amber-50/70">
              Competitive events, registration, and community tournaments through RVS Esports.
            </p>
            <Button to="/esports" variant="secondary" size="md">
              Explore tournaments →
            </Button>
          </Card>
        ) : (
          <>
            <Card variant="elevated" className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-3">
                <Badge tone="signal">RVS Esports</Badge>
                <h2 className="font-display text-xl font-semibold text-amber-50 sm:text-2xl">
                  Live tournament registration
                </h2>
                <p className="max-w-xl text-sm text-amber-50/70">
                  RVS Esports runs real tournament registration on top of the NanashiCollectibles
                  platform — starting with Apex Legends, and built to support more games over time.
                </p>
              </div>
              <Button to="/esports/tournaments" variant="secondary" className="shrink-0">
                View all tournaments
              </Button>
            </Card>

            {isLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <SkeletonCard />
                <SkeletonCard className="hidden sm:block" />
                <SkeletonCard className="hidden lg:block" />
              </div>
            ) : openTournaments.length === 0 ? (
              <EmptyState
                title="No tournaments are open right now"
                description="Check back soon, or visit RVS Esports for announcements."
                action={
                  <Button to="/esports" variant="secondary" size="md">
                    View RVS Esports
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {openTournaments.map((tournament) => (
                  <TournamentCard key={tournament.id} tournament={tournament} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Section>
  );
}

function ShopSection() {
  return (
    <Section spacing="md">
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div className="flex flex-col gap-4">
          <BlurFade inView>
            <SectionHeading
              size="section"
              eyebrow="Shop"
              title="Trading cards, collectibles, and technology"
              description="The categories the storefront is organized around, from trading card singles to drone and computer parts."
            />
          </BlurFade>
          <Button to="/shop" variant="secondary" className="w-fit">
            Browse categories
          </Button>
        </div>

        <Card className="flex flex-wrap content-start gap-2">
          {shopCategories.map((category) => (
            <Badge key={category.name} className="px-3 py-1.5 text-sm">
              {category.name}
            </Badge>
          ))}
        </Card>
      </div>
    </Section>
  );
}

function ServicesSection() {
  return (
    <Section tone="muted" spacing="md">
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div className="flex flex-col gap-4">
          <BlurFade inView>
            <SectionHeading
              size="section"
              eyebrow="Services"
              title="Professional services beyond the shop"
              description="Drone, website, and application development, delivered as real projects with a quotation — not shop checkout items."
            />
          </BlurFade>
          <Button to="/services" variant="secondary" className="w-fit">
            View all services
          </Button>
        </div>

        <div className="flex flex-col gap-3">
          {services.map((service) => (
            <Card
              key={service.key}
              as={Link}
              to={service.to}
              variant="interactive"
              className="flex items-center justify-between gap-4"
            >
              <div>
                <h3 className="font-display text-base font-semibold text-amber-50">{service.name}</h3>
                <p className="mt-1 text-sm text-amber-50/60">{service.summary}</p>
              </div>
              <span aria-hidden="true" className="shrink-0 text-amber-50/30">
                →
              </span>
            </Card>
          ))}
        </div>
      </div>
    </Section>
  );
}

function TcgSection() {
  return (
    <Section spacing="sm">
      <BlurFade inView>
        <SectionHeading
          size="section"
          eyebrow="TCG Community"
          title="Built for the games you already play"
          description="Card singles, decklists, and events, organized by game — not locked to one franchise."
        />
      </BlurFade>
      <div className="mt-6 flex flex-wrap gap-3">
        {tcgGames.map((game) => (
          <Badge key={game} tone="gold" className="px-4 py-2 text-sm">
            {game}
          </Badge>
        ))}
        <Badge tone="neutral" className="px-4 py-2 text-sm">
          More games coming
        </Badge>
      </div>
      <Button to="/tcg" variant="link" className="mt-6">
        Visit the TCG hub →
      </Button>
    </Section>
  );
}

function FinalCta() {
  return (
    <Section tone="muted" spacing="lg" className="pb-24">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
        <BlurFade inView>
          <SectionHeading
            align="center"
            eyebrow="About Nanashi"
            title="One platform, several communities"
            description="NanashiCollectibles connects a TCG and collectibles shop, professional drone and software services, and RVS esports under one roof — built to grow one module at a time."
          />
        </BlurFade>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button to="/contact">Get in touch</Button>
          <Button to="/about" variant="secondary">
            Learn more about us
          </Button>
        </div>
      </div>
    </Section>
  );
}

export default function HomePage() {
  return (
    <>
      <Hero />
      <ExploreNanashi />
      <EsportsSpotlight />
      <ShopSection />
      <ServicesSection />
      <TcgSection />
      <FinalCta />
    </>
  );
}
