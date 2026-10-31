import Section from "../../components/layout/Section.jsx";
import SectionHeading from "../../components/ui/SectionHeading.jsx";
import BlurFade from "../../components/ui/BlurFade.jsx";

// Adapted from the Velorah reference's "stats row" pattern (a plain-text
// display value + small caption, four columns, no card borders/shadows at
// all) — used here instead of another bordered-card grid for deliberate
// visual variety against the sections above and below it. Every value is
// either a literal, verifiable count (4 real verticals) or an honest
// descriptive claim — never an invented number.
const STATS = [
  { value: "4+", label: "Platform verticals" },
  { value: "Live", label: "Real-time registration & orders" },
  { value: "Local", label: "Real, local support" },
  { value: "Growing", label: "Built to expand" },
];

export default function WhyNanashi() {
  return (
    <Section spacing="md" containerSize="wide" className="border-y border-white/5">
      <BlurFade inView>
        <SectionHeading
          align="center"
          size="section"
          eyebrow="Why Nanashi"
          title="More than a store."
          description="Commerce, community, competition, and services under one platform — built to grow one vertical at a time, not stay a single niche forever."
          className="mx-auto"
        />
      </BlurFade>

      <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
        {STATS.map((stat) => (
          <div key={stat.label} className="flex flex-col items-center gap-1.5 text-center">
            <p className="font-display text-3xl font-semibold text-amber-50 sm:text-4xl">{stat.value}</p>
            <p className="text-xs uppercase tracking-[0.14em] text-amber-50/50">{stat.label}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
