function DatabaseSection({ databaseWork }) {
  return (
    <section className="border-b border-[#2a2a2a] px-5 py-6 md:px-12 md:py-11">
      <div className="mb-5 flex flex-col items-start justify-between gap-3 md:flex-row md:items-end">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#ef4444]">
          Database Work
        </p>
        <h2 className="font-['Syne'] text-[clamp(1.5rem,3vw,2.3rem)] text-[#ffffff]">
          Data Architecture and Reliability
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {databaseWork.map((item) => (
          <article
            className="interactive-card rounded-xl border border-[#2a2a2a] bg-[#161616] p-4"
            key={item.title}
          >
            <p className="inline-block rounded-full bg-[#ef4444]/10 px-2.5 py-1 text-xs font-bold text-[#ef4444]">
              {item.database}
            </p>
            <h3 className="mt-3 font-['Syne'] text-lg text-[#ffffff]">{item.title}</h3>
            <p className="mt-2 leading-relaxed text-[#9ca3af]">{item.outcome}</p>
            <ul className="mt-3 list-disc space-y-1 pl-4 text-sm leading-relaxed text-[#9ca3af]">
              {item.highlights.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  )
}

export default DatabaseSection