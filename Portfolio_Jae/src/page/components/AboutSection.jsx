function AboutSection({ aboutMe }) {
  return (
    <section id="about" className="border-b border-[#2a2a2a] px-5 py-6 md:px-12 md:py-11">
      <div className="mb-5 flex flex-col items-start justify-between gap-3 md:flex-row md:items-end">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#ef4444]">
          About Me
        </p>
        <h2 className="font-['Syne'] text-[clamp(1.5rem,3vw,2.3rem)] text-[#ffffff]">
          Professional Snapshot
        </h2>
      </div>

      <article className="interactive-card rounded-xl border border-[#2a2a2a] bg-[#161616] p-5 md:p-6">
        <h3 className="font-['Syne'] text-[clamp(1.2rem,2vw,1.8rem)] text-[#ffffff]">
          {aboutMe.title}
        </h3>
        <p className="mt-3 max-w-4xl leading-relaxed text-[#9ca3af]">{aboutMe.summary}</p>

        <ul className="mt-4 list-disc space-y-2 pl-5 leading-relaxed text-[#9ca3af]">
          {aboutMe.highlights.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </article>
    </section>
  )
}

export default AboutSection