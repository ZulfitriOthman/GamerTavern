function HeroSection() {
  return (
    <section className="animate-slide-fade border-b border-[#d2c4ab] px-5 py-6 md:px-12 md:py-11">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1f6f78]">
        Portfolio / Zulfitri
      </p>
      <h1 className="mt-4 font-['Syne'] text-[clamp(2rem,7vw,4.2rem)] leading-[1.02] text-[#1b1b20]">
        Building digital products across web, apps, and data systems.
      </h1>
      <p className="mt-4 max-w-[70ch] leading-relaxed text-[#55576a]">
        I design and develop reliable solutions, from user-facing interfaces to
        backend services and structured database platforms.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <a
          className="rounded-full bg-[#1f6f78] px-5 py-2.5 text-sm font-bold text-[#f4f8f9] transition hover:-translate-y-0.5"
          href="#projects"
        >
          View Projects
        </a>
        <a
          className="rounded-full border border-[#d2c4ab] bg-white/80 px-5 py-2.5 text-sm font-bold text-[#1b1b20] transition hover:-translate-y-0.5"
          href="#skills"
        >
          Explore Skills
        </a>
      </div>
    </section>
  )
}

export default HeroSection