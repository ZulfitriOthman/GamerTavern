import DroneShowcase from "../components/fleet/DroneShowcase";
import SpotlightCard from "../components/SpotlightCard";

function FleetPage({ fleet }) {
  const primaryDrones = fleet.filter((drone) => drone.primary);
  const secondaryDrones = fleet.filter((drone) => !drone.primary);

  return (
    <section className="px-4 pb-14 pt-28 md:px-10 md:pb-20 md:pt-32">
      <div className="reveal mb-10 max-w-2xl">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-skyaccent">
          Drone Fleet
        </p>
        <h1 className="font-display text-5xl leading-[0.95] tracking-wide md:text-7xl">
          Two Platforms, Two Mission Styles
        </h1>
      </div>

      <div className="space-y-6">
        {primaryDrones.map((drone) => (
          <DroneShowcase key={drone.id} drone={drone} />
        ))}

        {secondaryDrones.map((drone, index) => (
          <SpotlightCard
            as="article"
            key={drone.id}
            data-delay={index * 100}
            className="reveal rounded-2xl border border-white/15 bg-gradient-to-br from-slate-900 to-slate-800 shadow-panel"
          >
            <div className="grid grid-cols-1 gap-0 md:grid-cols-[1fr_1.4fr]">
              <img
                src={drone.image}
                alt={drone.imageAlt}
                className="h-56 w-full rounded-t-2xl object-cover md:h-full md:rounded-l-2xl md:rounded-tr-none"
                loading="lazy"
              />
              <div className="p-5 md:p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-skyaccent">
                  {drone.tagline}
                </p>
                <h2 className="mt-1 font-display text-3xl tracking-wide md:text-4xl">{drone.name}</h2>
                <p className="mb-4 text-warmaccent">{drone.role}</p>
                <div className="mb-4 flex gap-3">
                  {drone.keyStats.map((stat) => (
                    <div key={stat.label} className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2">
                      <p className="font-display text-xl tracking-wide text-white">{stat.value}</p>
                      <p className="text-[10px] uppercase tracking-[0.1em] text-slate-400">{stat.label}</p>
                    </div>
                  ))}
                </div>
                <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
                  {drone.specs.map((spec) => (
                    <div key={spec.label} className="border-t border-white/10 pt-2">
                      <dt className="text-[11px] uppercase tracking-[0.1em] text-slate-500">{spec.label}</dt>
                      <dd className="text-sm text-slate-200">{spec.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </SpotlightCard>
        ))}
      </div>
    </section>
  );
}

export default FleetPage;
