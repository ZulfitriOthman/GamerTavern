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
    <Section className="pt-20 sm:pt-28">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
        <Badge tone="signal">{site.name}</Badge>
        <h1 className="font-display text-4xl font-semibold leading-tight text-amber-50 sm:text-6xl">
          Collect. Create. <span className="text-brand-400">Compete.</span> Build.
        </h1>
        <p className="max-w-xl text-base text-amber-50/70 sm:text-lg">{site.description}</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button to="/shop" size="lg">
            Explore the shop
          </Button>
          <Button to="/contact" variant="secondary" size="lg">
            Talk to us about a project
          </Button>
        </div>
      </div>
    </Section>
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
