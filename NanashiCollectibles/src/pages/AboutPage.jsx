import Section from "../components/layout/Section.jsx";
import SectionHeading from "../components/ui/SectionHeading.jsx";
import Card from "../components/ui/Card.jsx";
import { businessPillars } from "../config/site.js";

export default function AboutPage() {
  return (
    <Section className="pt-16 sm:pt-24">
      <SectionHeading
        eyebrow="About"
        title="Collect. Create. Compete. Build."
        description="NanashiCollectibles isn't only a card shop. It's a single platform for the hobby, technology, and professional-service communities we're building around."
      />

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {businessPillars.map((pillar) => (
          <Card key={pillar.key} className="flex flex-col gap-2">
            <h2 className="font-display text-base font-semibold text-amber-50">{pillar.name}</h2>
            <p className="text-sm text-amber-50/60">{pillar.summary}</p>
          </Card>
        ))}
      </div>
    </Section>
  );
}
