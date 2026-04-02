function ContactSection() {
  return (
    <>
      <section className="bg-gradient-to-r from-[#1f6f7815] to-[#ea7f2d1a] px-5 py-6 md:px-12 md:py-11">
        <h2 className="font-['Syne'] text-[clamp(1.5rem,3vw,2.3rem)] text-[#1b1b20]">
          Let&apos;s Build Something Impactful
        </h2>
        <p className="mt-3 max-w-3xl leading-relaxed text-[#55576a]">
          Available for freelance and collaboration on website development,
          business applications, and database modernization.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <a
            className="rounded-full bg-[#1f6f78] px-5 py-2.5 text-sm font-bold text-[#f4f8f9] transition hover:-translate-y-0.5"
            href="mailto:zulfitri@example.com"
          >
            Contact Me
          </a>
          <a
            className="rounded-full border border-[#d2c4ab] bg-white/80 px-5 py-2.5 text-sm font-bold text-[#1b1b20] transition hover:-translate-y-0.5"
            href="#"
          >
            Download CV
          </a>
        </div>
      </section>

      <footer className="px-5 py-6 text-sm text-[#55576a] md:px-12">
        <p>2026 Zulfitri Portfolio. Crafted with React and Tailwind CSS.</p>
      </footer>
    </>
  )
}

export default ContactSection