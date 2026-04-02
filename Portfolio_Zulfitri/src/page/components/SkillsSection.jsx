function SkillsSection({ skillCards }) {
  return (
    <section id="skills" className="border-b border-[#2a2a2a] px-5 py-6 md:px-12 md:py-11">
      <div className="mb-5 flex flex-col items-start justify-between gap-3 md:flex-row md:items-end">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#f97316]">
          What I Do
        </p>
        <h2 className="font-['Syne'] text-[clamp(1.5rem,3vw,2.3rem)] text-[#ffffff]">
          Core Services
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {skillCards.map((card, index) => (
          <article
            className="interactive-card animate-rise-in rounded-[18px] border border-[#2a2a2a] bg-[#161616] p-4"
            key={card.title}
            style={{ animationDelay: `${index * 120}ms` }}
          >
            <p className="inline-block rounded-full bg-[#f9731620] px-2.5 py-1 text-xs font-bold text-[#f97316]">
              {card.badge}
            </p>
            <h3 className="mt-3 font-['Syne'] text-xl text-[#ffffff]">{card.title}</h3>
            <ul className="mt-3 list-disc space-y-1 pl-4 leading-relaxed text-[#9ca3af]">
              {card.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  )
}

export default SkillsSection