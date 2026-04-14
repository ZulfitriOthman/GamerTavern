function ProjectsSection({ projectSamples }) {
  return (
    <section id="projects" className="border-b border-[#2a2a2a] px-5 py-6 md:px-12 md:py-11">
      <div className="mb-5 flex flex-col items-start justify-between gap-3 md:flex-row md:items-end">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#ef4444]">
          Selected Work
        </p>
        <h2 className="font-['Syne'] text-[clamp(1.5rem,3vw,2.3rem)] text-[#ffffff]">
          Project Highlights
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projectSamples.map((project) => (
          <article
            className="interactive-card overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#161616]"
            key={project.name}
          >
            {project.image && (
              <div className="h-44 w-full overflow-hidden border-b border-[#2a2a2a]">
                <img
                  alt={`${project.name} preview`}
                  className="h-full w-full object-cover object-top"
                  src={project.image}
                />
              </div>
            )}
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-['Syne'] text-lg text-[#ffffff]">{project.name}</h3>
                {project.badge && (
                  <span className="shrink-0 rounded-full bg-[#ef4444]/10 px-2.5 py-1 text-[10px] font-bold text-[#ef4444]">
                    {project.badge}
                  </span>
                )}
              </div>
              <p className="mb-2 mt-1 text-xs font-bold text-[#ef4444]">{project.stack}</p>
              <p className="leading-relaxed text-[#9ca3af]">{project.summary}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {project.url && (
                  <a
                    className="interactive-cta inline-block rounded-full border border-[#ef4444]/40 px-3.5 py-1.5 text-xs font-bold text-[#ef4444]"
                    href={project.url}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Visit Site ↗
                  </a>
                )}
                {project.playStore && (
                  <a
                    className="interactive-cta inline-block rounded-full border border-[#ef4444]/40 px-3.5 py-1.5 text-xs font-bold text-[#ef4444]"
                    href={project.playStore}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Google Play ↗
                  </a>
                )}
                {project.appStore && (
                  <a
                    className="interactive-cta inline-block rounded-full border border-[#ef4444]/40 px-3.5 py-1.5 text-xs font-bold text-[#ef4444]"
                    href={project.appStore}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    App Store ↗
                  </a>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export default ProjectsSection