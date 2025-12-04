// src/pages/NewsPage.jsx
import { Link } from "react-router-dom";

function NewsPage() {
  // Later: replace with backend / CMS feed
  const dummyNews = [
    {
      id: 1,
      title: "Preorders Opening for the Next MTG Set",
      date: "2025-12-10",
      tag: "Announcement",
      body: "We are preparing limited allocations for the upcoming Magic: The Gathering release. Preorder windows will be announced with pricing and bundle options.",
    },
    {
      id: 2,
      title: "Weekly TCG Nights at the Tavern",
      date: "2025-12-15",
      tag: "Events",
      body: "Join our weekly gatherings for Magic, Yu-Gi-Oh!, Pokémon, and Vanguard. Casual play, small tournaments, and a space to test new decks.",
    },
    {
      id: 3,
      title: "Buylist & Trade-In Program Incoming",
      date: "2026-01-01",
      tag: "Update",
      body: "We are designing a buylist system so you can convert your cards into store credit or cash. Perfect for rotating formats and upgrading decks.",
    },
  ];

  return (
    <div className="relative space-y-6">
      {/* Background glows */}
      <div className="pointer-events-none absolute -left-16 top-0 h-48 w-48 rounded-full bg-purple-900/30 blur-3xl" />
      <div className="pointer-events-none absolute right-0 bottom-0 h-56 w-56 rounded-full bg-amber-800/25 blur-3xl" />

      {/* Header block */}
      <section className="relative overflow-hidden rounded-2xl border border-amber-900/40 bg-gradient-to-br from-slate-950 via-purple-950/45 to-slate-950 p-6 shadow-[0_0_40px_rgba(15,23,42,0.9)] ring-1 ring-purple-900/40">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-6 top-3 h-px bg-gradient-to-r from-transparent via-amber-400/70 to-transparent" />
          <div className="absolute inset-x-6 bottom-3 h-px bg-gradient-to-r from-transparent via-amber-400/70 to-transparent" />
        </div>

        <p className="mb-2 font-serif text-[11px] uppercase tracking-[0.35em] text-amber-500">
          Tavern Chronicle
        </p>
        <h2 className="font-serif text-3xl font-bold text-amber-100 md:text-4xl">
          News from the Gamer&apos;s Tavern.
        </h2>
        <p className="mt-3 max-w-2xl text-sm italic text-amber-100/75">
          Announcements on product waves, events, and store updates. This is
          where your players discover what&apos;s happening next.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full border border-amber-700/40 bg-amber-950/40 px-3 py-1 font-serif text-[10px] uppercase tracking-wide text-amber-200">
            Sets & Preorders
          </span>
          <span className="rounded-full border border-purple-700/40 bg-purple-950/40 px-3 py-1 font-serif text-[10px] uppercase tracking-wide text-purple-100">
            Events & Tournaments
          </span>
          <span className="rounded-full border border-emerald-700/40 bg-emerald-950/30 px-3 py-1 font-serif text-[10px] uppercase tracking-wide text-emerald-100">
            Store Updates
          </span>
        </div>
      </section>

      {/* News list */}
      <section className="relative space-y-3 rounded-2xl border border-amber-900/40 bg-gradient-to-br from-slate-950 to-purple-950/40 p-5 shadow-[0_0_30px_rgba(15,23,42,0.85)]">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-serif text-lg font-bold text-amber-100">
            Latest Announcements
          </h3>
          <span className="font-serif text-[11px] italic text-amber-400">
            Later, this can be fed from a CMS or database.
          </span>
        </div>

        <div className="space-y-3">
          {dummyNews.map((item) => (
            <article
              key={item.id}
              className="relative overflow-hidden rounded-2xl border border-amber-900/40 bg-gradient-to-r from-slate-950/90 via-purple-950/45 to-slate-950/90 p-4 shadow-md shadow-slate-900/70 transition-all hover:-translate-y-1 hover:border-amber-500/60 hover:shadow-amber-900/40"
            >
              {/* Accent bar */}
              <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-amber-500 via-purple-500 to-amber-500 opacity-80" />

              <div className="flex flex-wrap items-center justify-between gap-3 pl-3">
                <div>
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-amber-700/60 bg-amber-950/70 px-2.5 py-0.5 font-serif text-[10px] uppercase tracking-[0.18em] text-amber-200">
                      {item.tag}
                    </span>
                    <span className="font-serif text-[11px] text-amber-300/80">
                      {item.date}
                    </span>
                  </div>
                  <h3 className="font-serif text-sm font-semibold text-amber-50">
                    {item.title}
                  </h3>
                </div>
              </div>

              <p className="mt-2 pl-3 font-serif text-[13px] text-amber-100/80">
                {item.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <div className="relative flex justify-end">
        <Link
          to="/"
          className="inline-flex items-center rounded-full border border-amber-700/60 bg-gradient-to-r from-amber-950/70 to-purple-950/70 px-4 py-1.5 font-serif text-[11px] uppercase tracking-[0.18em] text-amber-100 shadow-md shadow-amber-900/40 transition-all hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-amber-500/60"
        >
          ← Back to Shop
        </Link>
      </div>
    </div>
  );
}

export default NewsPage;
