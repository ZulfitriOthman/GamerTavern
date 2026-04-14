import profileImage from '../../assets/my-photo.jpg'

function HeroSection({ toolStack, toolDescriptions }) {
  return (
    <section className="animate-slide-fade border-b border-[#2a2a2a] px-5 py-6 md:px-12 md:py-11">
      <div className="flex flex-col-reverse gap-6 md:flex-row md:items-center md:justify-between md:gap-10">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#ef4444]">
            Portfolio / Jae
          </p>
          <h1 className="mt-4 font-['Syne'] text-[clamp(2rem,7vw,4.2rem)] leading-[1.02] text-[#ffffff]">
            Building digital products across web, apps, and data systems.
          </h1>
          <p className="mt-4 max-w-[70ch] leading-relaxed text-[#9ca3af]">
            I design and develop reliable solutions, from user-facing interfaces to
            backend services and structured database platforms.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              className="interactive-cta animate-cta-pulse rounded-full bg-[#ef4444] px-5 py-2.5 text-sm font-bold text-[#0d0d0d]"
              href="#projects"
            >
              View Projects
            </a>
            <a
              className="interactive-cta rounded-full border border-[#2a2a2a] bg-[#1a1a1a] px-5 py-2.5 text-sm font-bold text-[#ffffff]"
              href="#skills"
            >
              Explore Skills
            </a>
          </div>
        </div>

        <div className="relative mx-auto h-56 w-56 shrink-0 animate-profile-float md:mx-0 md:h-104 md:w-104">
          <div className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-[#ef4444]/20 blur-2xl animate-profile-glow" />
          <div className="h-full w-full overflow-hidden rounded-full border-2 border-[#ef4444] shadow-[0_0_0_8px_rgba(239,68,68,0.12)]">
          <img
            alt="Jae profile"
            className="h-full w-full object-cover"
            src={profileImage}
          />
          </div>
        </div>
      </div>

      <div className="mt-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#ef4444]">
          Tools I Use
        </p>
        <div className="mt-3 flex flex-wrap gap-2.5">
          {toolStack.map((tool, index) => (
            <span
              key={tool}
              className="animate-badge-pulse rounded-full border border-[#ef4444]/40 bg-[#ef4444]/10 px-3 py-1.5 text-xs font-bold text-[#ef4444]"
              style={{ animationDelay: `${index * 90}ms` }}
            >
              {tool}
            </span>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2.5 md:grid-cols-2">
          {toolDescriptions.map((tool) => (
            <article
              key={tool.name}
              className="interactive-card rounded-xl border border-[#2a2a2a] bg-[#161616] px-3.5 py-3"
            >
              <h3 className="font-['Syne'] text-base text-[#ffffff]">{tool.name}</h3>
              <p className="mt-1 text-sm leading-relaxed text-[#9ca3af]">{tool.summary}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export default HeroSection