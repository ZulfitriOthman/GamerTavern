import { Link } from "react-router-dom";
import Section from "../components/layout/Section.jsx";
import SectionHeading from "../components/ui/SectionHeading.jsx";
import SpotlightCard from "../components/ui/SpotlightCard.jsx";
import Icon from "../components/ui/Icon.jsx";
import { businessPillars, site } from "../config/site.js";

const PILLAR_ICON = {
  shop: "store",
  services: "wrench",
  tcg: "cards",
  esports: "trophy",
};

export default function AboutPage() {
  return (
    <>
      <Section spacing="lg" containerSize="narrow" className="pt-14 sm:pt-20">
        <SectionHeading eyebrow="About" title="Collect. Create. Compete. Build." description={site.description} />

        <div className="mt-8 flex flex-col gap-4 text-base leading-relaxed text-amber-50/70">
          <p>
            NanashiCollectibles isn't built as a single-purpose store. It's a shared platform that
            different parts of the same community actually use — people who collect and trade cards,
            people who need a website or drone footage for a real project, and people who show up to
            compete in RVS Esports tournaments.
          </p>
          <p>
            Rather than building all of that at once, NanashiCollectibles grows one module at a time
            — RVS Esports tournament registration is the first fully working vertical, with the shop,
            TCG community tools, and professional services following as each is wired up to the same
            account and platform underneath.
          </p>
        </div>
      </Section>

      <Section tone="muted" spacing="md" className="pb-24">
        <SectionHeading size="section" title="What's live on the platform" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {businessPillars.map((pillar) => (
            <SpotlightCard key={pillar.key} as={Link} to={pillar.to} className="flex flex-col gap-4 p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-brand-300">
                <Icon name={PILLAR_ICON[pillar.key] || "sparkle"} className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-display text-lg font-semibold text-amber-50">{pillar.name}</h2>
                <p className="mt-2 text-sm text-amber-50/65">{pillar.summary}</p>
              </div>
              <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-brand-300">
                Explore <span aria-hidden="true">→</span>
              </span>
            </SpotlightCard>
          ))}
        </div>
      </Section>
    </>
  );
}
