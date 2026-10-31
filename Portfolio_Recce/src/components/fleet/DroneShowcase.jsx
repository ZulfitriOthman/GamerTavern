import { lazy, Suspense, useEffect, useRef, useState } from "react";
import DroneFallback from "./DroneFallback";
import DroneErrorBoundary from "./drone3d/DroneErrorBoundary";
import useWebglSupport from "./drone3d/useWebglSupport";

// The 3D flight experience pulls in three.js + @react-three/fiber + drei —
// several hundred KB. It's dynamically imported so that JS is never fetched
// unless a WebGL-capable browser actually scrolls this section into view.
const DroneExperience = lazy(() => import("./drone3d/DroneExperience"));

function VisualPlaceholder() {
  return (
    <div className="mx-auto aspect-square w-full max-w-md animate-pulse rounded-3xl border border-white/10 bg-slate-900/60" />
  );
}

// The primary-drone "product showcase" card: a flying 3D drone (progressive
// enhancement) or a pseudo-3D tilting photo (fallback), plus identity, key
// stats, and an expandable full spec sheet.
function DroneShowcase({ drone }) {
  const [specsOpen, setSpecsOpen] = useState(false);
  const [activeHotspot, setActiveHotspot] = useState(null);
  const [inView, setInView] = useState(false);
  const sectionRef = useRef(null);
  const hasWebgl = useWebglSupport();
  const reducedMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (!sectionRef.current || inView) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, [inView]);

  const use3D = hasWebgl;

  const activeSpec = drone.hotspots
    ?.find((hotspot) => hotspot.id === activeHotspot)
    ? drone.specs.find(
        (spec) => spec.label === drone.hotspots.find((hotspot) => hotspot.id === activeHotspot).specLabel
      )
    : null;

  return (
    <div
      ref={sectionRef}
      className="reveal relative overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-6 shadow-panel md:p-10"
    >
      <div aria-hidden="true" className="hero-grid absolute inset-0 opacity-[0.06]" />

      <div className="relative z-10 grid gap-10 md:grid-cols-[1fr_1.05fr] md:items-center">
        <div className="mx-auto aspect-square w-full max-w-md">
          {use3D ? (
            inView ? (
              <DroneErrorBoundary
                fallback={
                  <DroneFallback
                    image={drone.image}
                    imageAlt={drone.imageAlt}
                    hotspots={drone.hotspots}
                    activeHotspot={activeHotspot}
                    onHotspotChange={setActiveHotspot}
                  />
                }
              >
                <Suspense fallback={<VisualPlaceholder />}>
                  <DroneExperience reducedMotion={reducedMotion} />
                </Suspense>
              </DroneErrorBoundary>
            ) : (
              <VisualPlaceholder />
            )
          ) : (
            <DroneFallback
              image={drone.image}
              imageAlt={drone.imageAlt}
              hotspots={drone.hotspots}
              activeHotspot={activeHotspot}
              onHotspotChange={setActiveHotspot}
            />
          )}
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-skyaccent">{drone.tagline}</p>
          <h3 className="mt-1 font-display text-4xl tracking-wide md:text-5xl">{drone.name}</h3>
          <p className="mt-1 text-warmaccent">{drone.role}</p>

          {!use3D && (
            <div className="mt-5 min-h-[64px] rounded-xl border border-white/10 bg-slate-950/40 p-4">
              {activeSpec ? (
                <>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-skyaccent">{activeSpec.label}</p>
                  <p className="mt-1 text-sm text-slate-100">{activeSpec.value}</p>
                </>
              ) : (
                <p className="text-sm text-slate-400">
                  Hover or tap a marker on the drone to explore its specs.
                </p>
              )}
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3">
            {drone.keyStats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-white/15 bg-slate-900/70 p-4">
                <p className="font-display text-3xl tracking-wide text-white">{stat.value}</p>
                <p className="text-xs uppercase tracking-[0.12em] text-slate-400">{stat.label}</p>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setSpecsOpen((prev) => !prev)}
            aria-expanded={specsOpen}
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:border-skyaccent/60 hover:text-skyaccent"
          >
            {specsOpen ? "Hide Full Specifications" : "Explore Full Specifications"}
            <svg
              className={`h-3.5 w-3.5 transition-transform ${specsOpen ? "rotate-180" : ""}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              aria-hidden="true"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {specsOpen && (
            <dl className="mt-4 grid grid-cols-1 gap-x-4 gap-y-3 border-t border-white/10 pt-4 sm:grid-cols-2">
              {drone.specs.map((spec) => (
                <div key={spec.label}>
                  <dt className="text-[11px] uppercase tracking-[0.1em] text-slate-500">{spec.label}</dt>
                  <dd className="text-sm text-slate-200">{spec.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
    </div>
  );
}

export default DroneShowcase;
