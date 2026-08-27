import { Link } from "react-router-dom";
import Section from "../components/layout/Section.jsx";
import SectionHeading from "../components/ui/SectionHeading.jsx";
import Card from "../components/ui/Card.jsx";
import Badge from "../components/ui/Badge.jsx";
import Button from "../components/ui/Button.jsx";
import {
  businessPillars,
  services,
  shopCategories,
  site,
  tcgGames,
} from "../config/site.js";

function Hero() {
  return (
    <section className="relative isolate overflow-hidden border-b border-white/10">
      <img
        src="/assets/game-bg/shop-bg.jpg"
        alt="A star-filled night sky"
        className="absolute inset-0 -z-20 h-full w-full object-cover"
      />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(9,7,20,.98)_0%,rgba(9,7,20,.86)_42%,rgba(9,7,20,.28)_100%)]" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink-950 via-transparent to-black/20" />

      <Section className="py-20 sm:py-28 lg:py-32">
        <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_.85fr]">
          <div className="flex max-w-2xl flex-col items-start gap-6">
            <Badge tone="signal">The collector's tavern</Badge>
            <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight text-amber-50 sm:text-7xl">
              Collect. Create. <span className="text-brand-400">Compete.</span> Build.
            </h1>
            <p className="max-w-xl text-base leading-7 text-amber-50/75 sm:text-lg">
              {site.description}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button to="/shop" size="lg">
                Explore the shop
              </Button>
              <Button to="/contact" variant="secondary" size="lg">
                Talk to us about a project
              </Button>
            </div>
          </div>

          <div className="hidden justify-self-end lg:flex lg:max-w-sm">
            <div className="rounded-2xl border border-white/15 bg-ink-950/55 p-6 shadow-2xl shadow-black/30 backdrop-blur-md">
              <div className="mb-8 flex items-center justify-between gap-4">
                <span className="text-xs font-semibold uppercase tracking-[.22em] text-amber-50/55">
                  NanashiCollectibles
                </span>
                <span className="h-2 w-2 rounded-full bg-brand-400 shadow-[0_0_14px_rgba(242,180,80,.9)]" />
              </div>
              <p className="font-display text-2xl font-semibold leading-tight text-amber-50">
                Find your next favorite pull.
              </p>
              <p className="mt-3 text-sm leading-6 text-amber-50/60">
                TCG singles, hobby essentials, collectibles, and a community built around the games you love.
              </p>
              <Link to="/tcg" className="mt-6 inline-flex text-sm font-semibold text-brand-400 transition-colors hover:text-brand-400">
                Meet the community <span aria-hidden="true" className="ml-2">→</span>
              </Link>
            </div>
          </div>
        </div>
      </Section>
    </section>
  );
}

function BusinessPillars() {
  return (
    <Section tone="muted">
      <SectionHeading
        eyebrow="What we do"
        title="More than a card shop"
        description="NanashiCollectibles spans four connected areas — browse the one that brings you here."
      />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {businessPillars.map((pillar) => (
          <Card key={pillar.key} as={Link} to={pillar.to} className="flex flex-col gap-2">
            <h3 className="font-display text-lg font-semibold text-amber-50">{pillar.name}</h3>
            <p className="text-sm text-amber-50/60">{pillar.summary}</p>
          </Card>
        ))}
      </div>
    </Section>
  );
}

function ShopCategories() {
  return (
    <Section>
      <SectionHeading
        eyebrow="Shop"
        title="Trading cards, collectibles, and technology"
        description="Product categories the storefront is being built around."
      />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shopCategories.map((category) => (
          <Card key={category.name} className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-display text-base font-semibold text-amber-50">
                {category.name}
              </h3>
              <Badge>Coming soon</Badge>
            </div>
            <p className="text-sm text-amber-50/60">{category.description}</p>
          </Card>
        ))}
      </div>
    </Section>
  );
}

function ProfessionalServices() {
  return (
    <Section tone="muted">
      <SectionHeading
        eyebrow="Services"
        title="Professional services beyond the shop"
        description="Enquire about a project and we'll follow up with a quotation."
      />
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {services.map((service) => (
          <Card key={service.key} as={Link} to={service.to} className="flex flex-col gap-2">
            <h3 className="font-display text-base font-semibold text-amber-50">
              {service.name}
            </h3>
            <p className="text-sm text-amber-50/60">{service.summary}</p>
          </Card>
        ))}
      </div>
    </Section>
  );
}

function TcgCommunity() {
  return (
    <Section>
      <SectionHeading
        eyebrow="TCG Community"
        title="Built for the games you already play"
        description="Card singles, decklists, and events, organized by game — not locked to one franchise."
      />
      <div className="mt-8 flex flex-wrap gap-3">
        {tcgGames.map((game) => (
          <Badge key={game} tone="gold" className="px-4 py-2 text-sm">
            {game}
          </Badge>
        ))}
        <Badge tone="neutral" className="px-4 py-2 text-sm">
          More games coming
        </Badge>
      </div>
    </Section>
  );
}

function EsportsSpotlight() {
  return (
    <Section tone="muted">
      <Card className="flex flex-col items-start gap-4 p-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3">
          <Badge tone="signal">RVS Esports</Badge>
          <h3 className="font-display text-2xl font-semibold text-amber-50">
            RVS Apex Legends Tournament
          </h3>
          <p className="max-w-xl text-sm text-amber-50/60">
            Tournament registration is being built on top of the existing tournament
            infrastructure. Registration details will be announced closer to launch.
          </p>
        </div>
        <Button to="/esports" variant="secondary">
          View esports
        </Button>
      </Card>
    </Section>
  );
}

function AboutTeaser() {
  return (
    <Section>
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
        <SectionHeading
          align="center"
          eyebrow="About"
          title="One platform, several communities"
          description="NanashiCollectibles connects a TCG and collectibles shop, professional drone and software services, and RVS esports under one roof — built to grow one module at a time."
        />
        <Button to="/about" variant="secondary">
          Learn more about us
        </Button>
      </div>
    </Section>
  );
}

function ContactCta() {
  return (
    <Section tone="muted" className="pb-24">
      <Card className="flex flex-col items-center gap-4 p-10 text-center">
        <h3 className="font-display text-2xl font-semibold text-amber-50">
          Have an order, project, or enquiry?
        </h3>
        <p className="max-w-lg text-sm text-amber-50/60">
          Reach out and we'll point you to the right part of NanashiCollectibles.
        </p>
        <Button to="/contact">Get in touch</Button>
      </Card>
    </Section>
  );
}

export default function HomePage() {
  return (
    <>
      <Hero />
      <BusinessPillars />
      <ShopCategories />
      <ProfessionalServices />
      <TcgCommunity />
      <EsportsSpotlight />
      <AboutTeaser />
      <ContactCta />
    </>
  );
}
