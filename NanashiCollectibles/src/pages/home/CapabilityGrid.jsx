import { Link } from "react-router-dom";
import Section from "../../components/layout/Section.jsx";
import SectionHeading from "../../components/ui/SectionHeading.jsx";
import Badge from "../../components/ui/Badge.jsx";
import SpotlightCard from "../../components/ui/SpotlightCard.jsx";
import BlurFade from "../../components/ui/BlurFade.jsx";
import Icon from "../../components/ui/Icon.jsx";
import { services, shopCategories, site, tcgGames } from "../../config/site.js";

const CAPABILITIES = [
  {
    index: "01",
    icon: "cart",
    name: "Shop",
    to: "/shop",
    span: "lg:col-span-3",
    description:
      "Trading cards, collectibles, and technology — one storefront for every category the platform carries.",
    tags: shopCategories.slice(0, 4).map((c) => c.name),
    cta: "Browse the shop",
  },
  {
    index: "02",
    icon: "trophy",
    name: "RVS Esports",
    to: "/esports",
    span: "lg:col-span-2",
    description: "Tournament infrastructure, live registration, and competitive events.",
    tags: ["Registration", "Live results"],
    cta: "View tournaments",
  },
  {
    index: "03",
    icon: "wrench",
    name: "Services",
    to: "/services",
    span: "lg:col-span-2",
    description: "Drone, website, application development, and event ticketing delivered as real client projects.",
    tags: services.map((s) => s.name.replace(/ (Development|Services?)$/, "")),
    cta: "View services",
  },
  {
    index: "04",
    icon: "cards",
    name: "TCG Community",
    to: "/tcg",
    span: "lg:col-span-3",
    description: `Games, singles, and events for ${tcgGames.length}+ trading card titles our community actually plays.`,
    tags: tcgGames.slice(0, 3),
    cta: "Visit the TCG hub",
  },
];

// Asymmetric bento retained from the previous version (3/2/2/3 track on a
// 5-column grid) — it already reads as more deliberate than a flat 4-up
// grid and gives Shop/TCG (the categories with the most real sub-content)
// more visual weight. Each card now carries an icon, real tags, and an
// explicit CTA line rather than just a title + two lines of copy.
export default function CapabilityGrid() {
  return (
    <Section spacing="md" containerSize="xwide">
      <BlurFade inView>
        <SectionHeading
          size="section"
          eyebrow="Explore Nanashi"
          title="One platform, several capabilities"
          description={`${site.name} is built to grow across commerce, competition, and craft — not to stay a single niche.`}
        />
      </BlurFade>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {CAPABILITIES.map((capability) => (
          <SpotlightCard
            key={capability.name}
            as={Link}
            to={capability.to}
            className={["flex h-full flex-col justify-between gap-6 p-7", capability.span].join(" ")}
          >
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-brand-300">
                  <Icon name={capability.icon} className="h-5 w-5" />
                </span>
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-signal-400">
                  {capability.index}
                </span>
              </div>
              <div>
                <h3 className="font-display text-2xl font-semibold text-amber-50">{capability.name}</h3>
                <p className="mt-2 max-w-md text-sm text-amber-50/65">{capability.description}</p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                {capability.tags.map((tag) => (
                  <Badge key={tag} className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-300 transition-transform duration-150 group-hover/spotlight:translate-x-0.5">
                {capability.cta}
                <span aria-hidden="true">→</span>
              </span>
            </div>
          </SpotlightCard>
        ))}
      </div>
    </Section>
  );
}
