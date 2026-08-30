import Section from "../components/layout/Section.jsx";
import { businessPillars, site } from "../config/site.js";

export default function AboutPage() {
  return (
    <Section spacing="lg" containerSize="narrow" className="pb-24 pt-14 sm:pt-20">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-signal-400">About</p>
      <h1 className="mt-3 font-display text-3xl font-semibold text-amber-50 sm:text-4xl">
        Collect. Create. Compete. Build.
      </h1>
      <p className="mt-5 text-base leading-relaxed text-amber-50/70 sm:text-lg">{site.description}</p>

      <div className="mt-10 flex flex-col gap-4 text-base leading-relaxed text-amber-50/70">
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

      <div className="mt-14 flex flex-col divide-y divide-white/5 border-t border-white/5">
        {businessPillars.map((pillar) => (
          <div key={pillar.key} className="py-6 first:pt-0">
            <h2 className="font-display text-xl font-semibold text-amber-50">{pillar.name}</h2>
            <p className="mt-2 text-sm text-amber-50/60">{pillar.summary}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
