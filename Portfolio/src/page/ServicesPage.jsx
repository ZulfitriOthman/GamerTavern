function ServicesPage({ services }) {
  return (
    <section className="px-4 pb-14 pt-28 md:px-10 md:pb-20 md:pt-32">
      <div className="mb-7 reveal">
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-skyaccent md:text-sm">
          Services
        </p>
        <h2 className="font-display text-4xl tracking-wide md:text-6xl">
          From Planning to Final Delivery
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {services.map((service, index) => (
          <article
            key={service.title}
            data-delay={index * 100}
            className="reveal rounded-2xl border border-white/15 bg-gradient-to-br from-slate-900 to-slate-800 p-5 shadow-panel"
          >
            <h3 className="mb-2 text-xl font-semibold">{service.title}</h3>
            <p className="text-slate-300">{service.copy}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default ServicesPage;
