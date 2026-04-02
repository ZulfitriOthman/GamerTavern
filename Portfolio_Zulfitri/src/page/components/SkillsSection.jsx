function SkillsSection({ skillCards }) {
  return (
    <section id="skills" className="border-b border-[#d2c4ab] px-5 py-6 md:px-12 md:py-11">
      <div className="mb-5 flex flex-col items-start justify-between gap-3 md:flex-row md:items-end">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1f6f78]">
          What I Do
        </p>
        <h2 className="font-['Syne'] text-[clamp(1.5rem,3vw,2.3rem)] text-[#1b1b20]">
          Core Services
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {skillCards.map((card, index) => (
          <article
            className="animate-rise-in rounded-[18px] border border-[#d2c4ab] bg-[#fffdf8] p-4"
            key={card.title}
            style={{ animationDelay: `${index * 120}ms` }}
          >
            <p className="inline-block rounded-full bg-[#1f6f781f] px-2.5 py-1 text-xs font-bold text-[#1f6f78]">
              {card.badge}
            </p>
            <h3 className="mt-3 font-['Syne'] text-xl text-[#1b1b20]">{card.title}</h3>
            <ul className="mt-3 list-disc space-y-1 pl-4 leading-relaxed text-[#55576a]">
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