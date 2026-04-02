function ProjectsSection({ projectSamples }) {
  return (
    <section id="projects" className="border-b border-[#d2c4ab] px-5 py-6 md:px-12 md:py-11">
      <div className="mb-5 flex flex-col items-start justify-between gap-3 md:flex-row md:items-end">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1f6f78]">
          Selected Work
        </p>
        <h2 className="font-['Syne'] text-[clamp(1.5rem,3vw,2.3rem)] text-[#1b1b20]">
          Project Highlights
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projectSamples.map((project) => (
          <article
            className="rounded-xl border border-[#d2c4ab] bg-[#efe6d359] p-4"
            key={project.name}
          >
            <h3 className="font-['Syne'] text-lg text-[#1b1b20]">{project.name}</h3>
            <p className="mb-2 mt-1 text-xs font-bold text-[#ea7f2d]">{project.stack}</p>
            <p className="leading-relaxed text-[#55576a]">{project.summary}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

export default ProjectsSection