import SpotlightCard from "../components/SpotlightCard";

const categoryIcons = {
  "Media Production": (
    <path d="M4 7h3l2-2h6l2 2h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z M12 10a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />
  ),
  "Property & Infrastructure": (
    <path d="M4 21V9l8-6 8 6v12h-5v-7h-6v7H4Z" />
  ),
  "Mapping & Data": (
    <path d="M9 3 3 6v15l6-3 6 3 6-3V3l-6 3-6-3Z M9 3v15 M15 6v15" />
  ),
  "Specialized & Response": (
    <path d="M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5l-8-3Z M12 8v5 M12 16h.01" />
  ),
};

function ServicesPage({ services }) {
  const totalServices = services.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <section className="px-4 pb-14 pt-28 md:px-10 md:pb-20 md:pt-32">
      <div className="reveal mb-10 max-w-3xl">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-skyaccent">
          Services
        </p>
        <h1 className="font-display text-5xl leading-[0.95] tracking-wide md:text-7xl">
          Full-Service Drone Operations
        </h1>
        <p className="mt-4 text-slate-300">
          End-to-end aerial support across media production, inspections, mapping, and operational intelligence.
        </p>
        <p className="mt-2 text-xs uppercase tracking-[0.12em] text-slate-500">
          {totalServices} services across {services.length} focus areas
        </p>
      </div>

      <div className="space-y-10">
        {services.map((group, groupIndex) => (
          <div key={group.category} data-delay={groupIndex * 60} className="reveal">
            <div className="mb-4 flex items-center gap-3">
              <span className="grid h-10 w-10 flex-none place-content-center rounded-xl border border-skyaccent/35 bg-skyaccent/10 text-skyaccent">
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {categoryIcons[group.category]}
                </svg>
              </span>
              <h2 className="font-display text-2xl tracking-wide text-warmaccent md:text-3xl">
                {group.category}
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {group.items.map((service) => (
                <SpotlightCard
                  as="article"
                  key={service.title}
                  className="rounded-2xl border border-white/15 bg-gradient-to-br from-slate-900 to-slate-800 p-5 shadow-panel transition duration-300 hover:-translate-y-1 hover:border-skyaccent/40"
                >
                  <h3 className="mb-2 text-lg font-semibold text-white">{service.title}</h3>
                  <p className="text-sm text-slate-300">{service.copy}</p>
                </SpotlightCard>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default ServicesPage;
