function ContactSection({ contactInfo }) {
  const {
    description,
    email,
    cvFileName,
    cvUrl,
    hireDescription,
    hireSubject,
    subject,
  } = contactInfo
  const contactLink = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(description)}`
  const hiringLink = `mailto:${email}?subject=${encodeURIComponent(hireSubject)}&body=${encodeURIComponent(hireDescription)}`
  const downloadUrl = cvUrl || `/${cvFileName}`

  return (
    <>
      <section className="bg-linear-to-r from-[#ef444415] to-[#ef444408] px-5 py-6 md:px-12 md:py-11">
        <h2 className="font-['Syne'] text-[clamp(1.5rem,3vw,2.3rem)] text-[#ffffff]">
          Let&apos;s Build Something Impactful
        </h2>
        <p className="mt-3 max-w-3xl leading-relaxed text-[#9ca3af]">
          Available for freelance and collaboration on website development,
          business applications, and database modernization.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <a
            className="interactive-cta animate-cta-pulse rounded-full bg-[#ef4444] px-5 py-2.5 text-sm font-bold text-[#0d0d0d]"
            href={contactLink}
          >
            Contact Me
          </a>
          <a
            className="interactive-cta rounded-full border border-[#ef4444]/50 bg-[#ef4444]/10 px-5 py-2.5 text-sm font-bold text-[#ef4444]"
            href={hiringLink}
          >
            Hire Me
          </a>
          <a
            className="interactive-cta rounded-full border border-[#2a2a2a] bg-[#1a1a1a] px-5 py-2.5 text-sm font-bold text-[#ffffff]"
            download={cvFileName}
            href={downloadUrl}
          >
            Download CV
          </a>
        </div>
      </section>

      <footer className="px-5 py-6 text-sm text-[#9ca3af] md:px-12">
        <p>2026 Jae Portfolio. Crafted with React and Tailwind CSS.</p>
      </footer>
    </>
  )
}

export default ContactSection