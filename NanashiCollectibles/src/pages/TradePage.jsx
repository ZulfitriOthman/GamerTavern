// src/pages/TradePage.jsx
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

function TradePage() {
  const [query, setQuery] = useState("");
  const [gameFilter, setGameFilter] = useState("all");
  const [conditionFilter, setConditionFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all"); // trade | sale | all

  const sampleListings = [
    {
      id: 1,
      title: "Playset of Lightning Bolt (Modern)",
      game: "mtg",
      condition: "Near Mint",
      want: "Shock lands / Fetches",
      notes: "Prefer local trade at events.",
      type: "trade",
    },
    {
      id: 2,
      title: "Blue-Eyes White Dragon (SDK-001)",
      game: "ygo",
      condition: "Lightly Played",
      want: "Competitive staple spell/trap lineup.",
      notes: "Serious offers only.",
      type: "trade",
    },
    {
      id: 3,
      title: "Charizard ex (Scarlet & Violet)",
      game: "pokémon",
      condition: "Near Mint",
      want: "High-tier tournament playable cards.",
      notes: "Can also sell if price is right.",
      type: "sale",
    },
    {
      id: 4,
      title: "Vanguard Deck Core (Budget Upgrade)",
      game: "vanguard",
      condition: "Near Mint",
      want: "Triggers / Key G3 upgrades",
      notes: "Trade preferred, sale acceptable.",
      type: "trade",
    },
  ];

  // Planned features list (so you can expand later easily)
  const plannedFeatures = [
    "User accounts & profiles.",
    "Trade listings linked to inventory.",
    "Offer system, chat, and safety rules.",
  ];

  const gameLabel = (g) => {
    switch (g) {
      case "mtg":
        return "Magic: The Gathering";
      case "ygo":
        return "Yu-Gi-Oh!";
      case "pokémon":
        return "Pokémon TCG";
      case "vanguard":
        return "Cardfight!! Vanguard";
      default:
        return "TCG";
    }
  };

  const typeLabel = (t) => {
    switch (t) {
      case "trade":
        return "For Trade";
      case "sale":
        return "For Sale";
      default:
        return "Listing";
    }
  };

  // Derive filter options from data (keeps it future-proof)
  const conditionOptions = useMemo(() => {
    const set = new Set(sampleListings.map((x) => x.condition).filter(Boolean));
    return ["all", ...Array.from(set)];
  }, []);

  const filteredListings = useMemo(() => {
    const q = query.trim().toLowerCase();

    return sampleListings.filter((item) => {
      // Game filter
      const gameOk = gameFilter === "all" ? true : item.game === gameFilter;

      // Condition filter (exact match)
      const conditionOk =
        conditionFilter === "all" ? true : item.condition === conditionFilter;

      // Type filter
      const typeOk = typeFilter === "all" ? true : item.type === typeFilter;

      // Search
      const qOk = !q
        ? true
        : [
            item.title,
            item.condition,
            item.want,
            item.notes,
            item.game,
            gameLabel(item.game),
            typeLabel(item.type),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(q);

      return gameOk && conditionOk && typeOk && qOk;
    });
  }, [query, gameFilter, conditionFilter, typeFilter]);

  const anyFilterActive =
    query.trim() ||
    gameFilter !== "all" ||
    conditionFilter !== "all" ||
    typeFilter !== "all";

  const clearAll = () => {
    setQuery("");
    setGameFilter("all");
    setConditionFilter("all");
    setTypeFilter("all");
  };

  return (
    <div className="relative space-y-6">
      {/* Background glow */}
      <div className="pointer-events-none absolute -left-20 top-10 h-52 w-52 rounded-full bg-purple-900/25 blur-3xl" />
      <div className="pointer-events-none absolute right-0 bottom-10 h-52 w-52 rounded-full bg-amber-800/25 blur-3xl" />

      {/* Header card */}
      <section className="relative overflow-hidden rounded-2xl border border-amber-900/40 bg-gradient-to-br from-slate-950 via-purple-950/50 to-slate-950 p-6 shadow-[0_0_40px_rgba(15,23,42,0.9)] ring-1 ring-purple-900/40">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-6 top-3 h-px bg-gradient-to-r from-transparent via-amber-400/70 to-transparent" />
          <div className="absolute inset-x-6 bottom-3 h-px bg-gradient-to-r from-transparent via-amber-400/70 to-transparent" />
        </div>

        <p className="mb-2 font-serif text-[11px] uppercase tracking-[0.35em] text-amber-500">
          Player Exchange
        </p>
        <h2 className="font-serif text-3xl font-bold text-amber-100 md:text-4xl">
          Trade Hub for Arcanists & Duelists.
        </h2>
        <p className="mt-3 max-w-2xl text-sm italic text-amber-100/75">
          A future space where players list cards for trade, set their wishes,
          and arrange safe swaps. For now, this is a preview of how listings
          might look.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full border border-amber-700/40 bg-amber-950/40 px-3 py-1 font-serif text-[10px] uppercase tracking-wide text-amber-200">
            Player to Player
          </span>
          <span className="rounded-full border border-purple-700/40 bg-purple-950/40 px-3 py-1 font-serif text-[10px] uppercase tracking-wide text-purple-100">
            Listings & Offers
          </span>
          <span className="rounded-full border border-emerald-700/40 bg-emerald-950/30 px-3 py-1 font-serif text-[10px] uppercase tracking-wide text-emerald-100">
            Future Direct Messaging
          </span>
        </div>
      </section>

      {/* Search + Filters + Listings */}
      <section className="relative space-y-4 rounded-2xl border border-amber-900/40 bg-gradient-to-br from-slate-950 to-purple-950/40 p-5 shadow-[0_0_30px_rgba(15,23,42,0.85)]">
        <div className="mb-2 flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="font-serif text-lg font-bold text-amber-100">
                Featured Trade Listings (Preview)
              </h3>
              <span className="font-serif text-[11px] italic text-amber-400">
                Real trading tools coming in a later update.
              </span>
            </div>

            <div className="flex items-center gap-2">
              {anyFilterActive && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="rounded-full border border-amber-700/40 bg-slate-950/40 px-4 py-2 font-serif text-[10px] uppercase tracking-[0.18em] text-amber-200 shadow-md shadow-amber-900/30 transition hover:-translate-y-0.5 hover:bg-slate-950/60"
                >
                  Clear all
                </button>
              )}
              <span className="font-serif text-[11px] text-amber-100/60">
                Showing {filteredListings.length} of {sampleListings.length}
              </span>
            </div>
          </div>

          {/* Controls row */}
          <div className="grid gap-3 lg:grid-cols-12">
            {/* Search */}
            <div className="lg:col-span-5">
              <label className="block font-serif text-[11px] tracking-wide text-amber-200/80">
                Search listings
              </label>
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-amber-800/30 bg-slate-950/40 px-3 py-2">
                <span className="text-amber-400/70">⌕</span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search: card, condition, wants…"
                  className="w-full bg-transparent font-serif text-sm text-amber-50 placeholder:text-amber-200/40 focus:outline-none"
                />
                {query.trim() && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="rounded-lg border border-amber-700/30 bg-slate-950/40 px-2 py-1 font-serif text-[10px] uppercase tracking-[0.18em] text-amber-200 hover:bg-slate-950/60"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Game filter */}
            <div className="lg:col-span-3">
              <label className="block font-serif text-[11px] tracking-wide text-amber-200/80">
                Game
              </label>
              <select
                value={gameFilter}
                onChange={(e) => setGameFilter(e.target.value)}
                className="mt-2 w-full rounded-xl border border-amber-800/30 bg-slate-950/40 px-3 py-2 font-serif text-sm text-amber-50 focus:outline-none"
              >
                <option value="all">All games</option>
                <option value="mtg">Magic: The Gathering</option>
                <option value="ygo">Yu-Gi-Oh!</option>
                <option value="pokémon">Pokémon TCG</option>
                <option value="vanguard">Cardfight!! Vanguard</option>
              </select>
            </div>

            {/* Condition filter */}
            <div className="lg:col-span-2">
              <label className="block font-serif text-[11px] tracking-wide text-amber-200/80">
                Condition
              </label>
              <select
                value={conditionFilter}
                onChange={(e) => setConditionFilter(e.target.value)}
                className="mt-2 w-full rounded-xl border border-amber-800/30 bg-slate-950/40 px-3 py-2 font-serif text-sm text-amber-50 focus:outline-none"
              >
                {conditionOptions.map((c) => (
                  <option key={c} value={c}>
                    {c === "all" ? "All conditions" : c}
                  </option>
                ))}
              </select>
            </div>

            {/* Type filter */}
            <div className="lg:col-span-2">
              <label className="block font-serif text-[11px] tracking-wide text-amber-200/80">
                Listing type
              </label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="mt-2 w-full rounded-xl border border-amber-800/30 bg-slate-950/40 px-3 py-2 font-serif text-sm text-amber-50 focus:outline-none"
              >
                <option value="all">All</option>
                <option value="trade">For Trade</option>
                <option value="sale">For Sale</option>
              </select>
            </div>
          </div>
        </div>

        {/* Listings */}
        <div className="space-y-3">
          {filteredListings.length === 0 ? (
            <div className="rounded-xl border border-amber-900/40 bg-slate-950/60 p-4 text-sm text-amber-100/70">
              No listings match your filters/search. Try clearing filters or
              searching keywords like{" "}
              <span className="text-amber-200">“Near Mint”</span>,{" "}
              <span className="text-amber-200">“Fetches”</span>, or{" "}
              <span className="text-amber-200">“Yu-Gi-Oh”</span>.
            </div>
          ) : (
            filteredListings.map((item) => (
              <article
                key={item.id}
                className="group relative flex flex-col gap-2 rounded-xl border border-amber-900/40 bg-gradient-to-r from-slate-950/90 via-purple-950/50 to-slate-950/90 p-4 shadow-md shadow-slate-900/70 transition-all hover:-translate-y-1 hover:border-amber-500/60 hover:shadow-amber-900/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-serif text-sm font-semibold text-amber-50">
                      {item.title}
                    </h4>
                    <p className="font-serif text-[11px] italic text-amber-200/80">
                      {gameLabel(item.game)} • {item.condition}
                    </p>
                  </div>

                  <span className="rounded-full border border-amber-700/50 bg-amber-950/60 px-3 py-1 font-serif text-[10px] uppercase tracking-wide text-amber-200">
                    {typeLabel(item.type)}
                  </span>
                </div>

                <div className="mt-1 grid gap-2 text-[11px] text-amber-100/80 sm:grid-cols-2">
                  <div>
                    <span className="font-serif text-amber-400">Wants:</span>{" "}
                    <span className="font-serif italic">{item.want}</span>
                  </div>
                  <div>
                    <span className="font-serif text-amber-400">Notes:</span>{" "}
                    <span className="font-serif italic">{item.notes}</span>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap justify-between gap-2 border-t border-amber-900/50 pt-2 text-[10px] text-amber-300/80">
                  <span className="font-serif">
                    Future actions: message, make offer, mark as completed.
                  </span>
                  <span className="font-serif text-amber-500/80">
                    Prototype layout only
                  </span>
                </div>
              </article>
            ))
          )}
        </div>

        {/* Planned Features */}
        <div className="mt-4 rounded-xl border border-amber-900/40 bg-slate-950/70 p-3 text-[11px] text-amber-100/75">
          <p className="font-serif">Later, we can wire this page to:</p>
          <ul className="mt-1 list-disc pl-5 font-serif text-amber-200/80">
            <li>User accounts & profiles.</li>
            <li>Trade listings linked to inventory.</li>
            <li>Offer system, chat, and safety rules.</li>
          </ul>
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

export default TradePage;
