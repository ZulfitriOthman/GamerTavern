import { useEffect, useState } from "react";
import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import BlurFade from "../../components/ui/BlurFade.jsx";
import { BlackHoleHeroSection } from "../../components/ui/BlackHoleHeroSection.jsx";
import { site } from "../../config/site.js";

const TRUST_ROW = ["Multi-community", "TCG", "Esports", "Services", "Commerce"];

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
//
// Copy column widened slightly (max-w-xl -> max-w-2xl) and inset against the
// same max-w-[1600px] stage every other section now uses, so the hero reads
// as part of one continuous width system instead of hugging the left edge on
// very large displays. The trailing trust row (adapted from the Velorah
// reference's compact stat-row treatment — small label, no card/border)
// replaces the page's only orphaned "supporting benefit" gap directly under
// the CTAs.
//
// `narrow` below now drives ONLY visual composition (focus/scrim/elevation/
// fov — where the hole sits and how the text-side veil reads on a portrait
// screen). Performance (ray-march steps, render resolution, DPR, bloom size,
// FPS) is `performanceMode="auto"`'s job now, resolved once inside
// BlackHoleHeroSection from actual device/browser capability signals — see
// that file's detectPerformanceMode() — rather than a second breakpoint
// check duplicated here. `steps`/`resolution`/`maxDpr`/`glow` below are the
// FULL-quality (desktop) numbers; auto-detected "balanced"/"static" tiers
// only ever cap them down, never raise them, so this hero's desktop
// appearance is unchanged from before this existed.
export default function Hero() {
  const narrow = useNarrowViewport();

  return (
    <section className="relative min-h-[92svh] w-full md:min-h-[760px]">
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
        glow={0.9}
        exposure={0.9}
        vignette={0.3}
        steps={240}
        resolution={0.68}
        maxDpr={1.5}
        performanceMode="auto"
      >
        <div className="mx-auto flex h-full min-h-[92svh] w-full max-w-[1600px] items-start px-4 pt-16 sm:px-6 sm:pt-20 md:min-h-[760px] md:items-center md:pt-0 lg:px-10">
          <div className="max-w-2xl">
            <BlurFade delay={0}>
              <Badge tone="signal">{site.name}</Badge>
            </BlurFade>

            <BlurFade delay={0.08}>
              <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.05] tracking-tight text-amber-50 sm:text-6xl lg:text-[5.25rem]">
                Giving form to <span className="text-brand-400">possibility.</span>
              </h1>
            </BlurFade>

            <BlurFade delay={0.18}>
              <p className="mt-6 max-w-xl text-base text-amber-50/70 sm:text-lg">{site.description}</p>
            </BlurFade>

            <BlurFade delay={0.28}>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button to="/about" size="lg">
                  Explore Nanashi
                </Button>
                <Button to="/services" variant="secondary" size="lg">
                  Our Services
                </Button>
              </div>
            </BlurFade>

            <BlurFade delay={0.38}>
              <div className="mt-10 flex max-w-xl flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/10 pt-5">
                {TRUST_ROW.map((label, i) => (
                  <span key={label} className="flex items-center gap-x-5">
                    {i > 0 ? <span aria-hidden="true" className="h-1 w-1 rounded-full bg-amber-50/25" /> : null}
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-50/50">
                      {label}
                    </span>
                  </span>
                ))}
              </div>
            </BlurFade>
          </div>
        </div>
      </BlackHoleHeroSection>
    </section>
  );
}
