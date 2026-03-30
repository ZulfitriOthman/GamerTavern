function FleetPage({ fleet }) {
  return (
    <section className="px-4 pb-14 pt-28 md:px-10 md:pb-20 md:pt-32">
      <div className="mb-7 reveal">
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-skyaccent md:text-sm">
          Drone Fleet
        </p>
        <h2 className="font-display text-4xl tracking-wide md:text-6xl">
          Two Platforms, Two Mission Styles
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {fleet.map((drone, index) => (
          <article
            key={drone.name}
            data-delay={index * 120}
            className="reveal rounded-2xl border border-white/15 bg-gradient-to-br from-slate-900 to-slate-800 p-5 shadow-panel"
          >
            <h3 className="font-display text-4xl tracking-wide">{drone.name}</h3>
            <p className="mb-3 text-warmaccent">{drone.role}</p>
            <ul className="list-disc space-y-2 pl-5 text-slate-300">
              {drone.specs.map((spec) => (
                <li key={spec}>{spec}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

export default FleetPage;
