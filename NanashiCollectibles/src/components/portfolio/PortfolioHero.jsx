import Badge from "../ui/Badge.jsx";
import Button from "../ui/Button.jsx";
import BlurFade from "../ui/BlurFade.jsx";
import { portfolioProfile } from "../../data/portfolioContent.js";

// Deliberately typographic, no personal photo — matches the rest of the site
// (Hero.jsx, AboutPage.jsx), which never uses human photography, only
// abstract/icon-driven visuals. Reuses BlurFade (already a real dependency
// via the homepage hero) for the same restrained section-reveal motion
// instead of introducing a second animation approach.
export default function PortfolioHero() {
  return (
    <section className="relative overflow-hidden border-b border-white/5 pb-16 pt-16 sm:pb-20 sm:pt-24">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 15% 20%, rgba(108, 86, 232, 0.16), transparent 55%), radial-gradient(circle at 85% 0%, rgba(43, 184, 178, 0.12), transparent 50%)",
        }}
      />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col px-4 sm:px-6 lg:px-8">
        <BlurFade delay={0}>
          <Badge tone="signal">Portfolio</Badge>
        </BlurFade>

        <BlurFade delay={0.08}>
          <h1 className="mt-6 font-display text-4xl font-semibold leading-[1.05] tracking-tight text-amber-50 sm:text-5xl lg:text-6xl">
            {portfolioProfile.name}
          </h1>
        </BlurFade>

        <BlurFade delay={0.16}>
          <p className="mt-4 max-w-2xl text-lg font-medium text-brand-300 sm:text-xl">{portfolioProfile.headline}</p>
        </BlurFade>

        <BlurFade delay={0.24}>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-amber-50/70 sm:text-lg">{portfolioProfile.intro}</p>
        </BlurFade>

        <BlurFade delay={0.32}>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button href="#projects" size="lg">
              View Projects
            </Button>
            <Button to="/contact" variant="secondary" size="lg">
              Get in Touch
            </Button>
            <Button href={portfolioProfile.cvUrl} variant="ghost" size="lg" download>
              Download CV
            </Button>
          </div>
        </BlurFade>
      </div>
    </section>
  );
}
