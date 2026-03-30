function ServicesPage({ services }) {
  return (
    <section className="px-4 pb-14 pt-28 md:px-10 md:pb-20 md:pt-32">
      <div className="mb-7 reveal">
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-skyaccent md:text-sm">
          Services
        </p>
        <h2 className="font-display text-4xl tracking-wide md:text-6xl">
          Full-Service Drone Operations
        </h2>
        <p className="mt-3 max-w-3xl text-slate-300">
          End-to-end aerial support across media production, inspections, mapping,
          and operational intelligence.
        </p>
        <p className="mt-2 text-xs uppercase tracking-[0.12em] text-slate-400">
          {services.length} services available
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {services.map((service, index) => (
          <article
            key={service.title}
            data-delay={index * 100}
            className="reveal rounded-2xl border border-white/15 bg-gradient-to-br from-slate-900 to-slate-800 p-5 shadow-panel transition duration-300 hover:-translate-y-1 hover:border-white/30"
          >
            <h3 className="mb-2 text-xl font-semibold text-white">{service.title}</h3>
            <p className="text-slate-300">{service.copy}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default ServicesPage;
