function ContactPage() {
  return (
    <section className="px-4 pb-14 pt-28 md:px-10 md:pb-20 md:pt-32">
      <div className="reveal max-w-4xl rounded-2xl border border-white/15 bg-gradient-to-br from-slate-900 to-slate-800 p-6 shadow-panel md:p-8">
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-skyaccent md:text-sm">
          Contact
        </p>
        <h2 className="font-display text-4xl tracking-wide md:text-6xl">
          Let Your Next Project Take Off
        </h2>
        <p className="mt-3 text-slate-300">
          Share your location, timeline, and goals. I will reply with a flight plan and quote.
        </p>
        <div className="mt-5 flex flex-wrap gap-4 text-slate-100">
          <a
            href="mailto:muhd.izrat@gmail.com"
            className="underline decoration-skyaccent decoration-2 underline-offset-4"
          >
            muhd.izrat@gmail.com
          </a>
          <a
            href="tel:+1234567890"
            className="underline decoration-skyaccent decoration-2 underline-offset-4"
          >
            +673 879 3875
          </a>
          <a href="/" className="underline decoration-skyaccent decoration-2 underline-offset-4">
            Instagram: @flybyrecce / YouTube
          </a>
        </div>
      </div>
    </section>
  );
}

export default ContactPage;
