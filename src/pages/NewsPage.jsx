import { useEffect, useMemo, useRef, useState } from "react";
import { createChart, LineSeries } from "lightweight-charts";
/* ------------------------------------------------------------------ */

const CATEGORIES = ["All", "Magic", "Yu-Gi-Oh", "Pokemon", "Vanguard", "General"];

// Mock data (replace with your API later)
const NEWS = [
  {
    id: "news-001",
    title: "Weekly Market Watch: Staple Singles Holding Strong",
    excerpt:
      "A quick look at staple price movement across top formats and what collectors are watching this week.",
    category: "General",
    date: "2025-12-15",
    readTime: "4 min",
    featured: true,
    image:
      "https://images.unsplash.com/photo-1612036781124-847f8939c3f3?auto=format&fit=crop&w=1200&q=70",
    content: [
      "Collectors are prioritizing liquidity this week: staples with consistent demand remain stable.",
      "If you're stocking inventory, focus on evergreen cards that sell steadily instead of hype spikes.",
      "Watch reprint risk. The safest holds usually have multi-format play or strong collector appeal.",
    ],
    source: "Gamer Tavern Scribe Desk",
  },
  {
    id: "news-002",
    title: "Magic: Commander Staples — What Still Moves Fast",
    excerpt:
      "A practical shortlist of Commander-friendly staples that customers keep asking for.",
    category: "Magic",
    date: "2025-12-13",
    readTime: "3 min",
    image:
      "https://images.unsplash.com/photo-1604719312566-8912e9227c6a?auto=format&fit=crop&w=1200&q=70",
    content: [
      "Commander demand is consistent: players upgrade decks gradually but repeatedly.",
      "Bundle staples in 'upgrade packs' to raise AOV while making the choice easy for buyers.",
      "Keep a small wall of fast movers and rotate weekly based on sell-through.",
    ],
    source: "Gamer Tavern Scribe Desk",
  },
  {
    id: "news-003",
    title: "Yu-Gi-Oh: Side Deck Tech Trends (Local Meta Edition)",
    excerpt:
      "Common side deck answers you’ll see at locals — and how to stock smart without overbuying.",
    category: "Yu-Gi-Oh",
    date: "2025-12-11",
    readTime: "5 min",
    image:
      "https://images.unsplash.com/photo-1553484771-371a605b060b?auto=format&fit=crop&w=1200&q=70",
    content: [
      "Side deck demand spikes after tournaments: stock a modest quantity and restock quickly if needed.",
      "Offer a 'side deck bundle' for new players: it sells well and drives repeat visits for upgrades.",
      "Track what wins in your community; local meta is more predictive than global chatter.",
    ],
    source: "Gamer Tavern Scribe Desk",
  },
  {
    id: "news-004",
    title: "Pokémon: Sealed vs Singles — What Collectors Prefer This Month",
    excerpt:
      "Collector behavior tends to swing—here’s how to balance sealed display with singles turnover.",
    category: "Pokemon",
    date: "2025-12-09",
    readTime: "4 min",
    image:
      "https://images.unsplash.com/photo-1611605698335-8b1569810432?auto=format&fit=crop&w=1200&q=70",
    content: [
      "Sealed sells when it’s visible and feels special: make a 'vault shelf' with lighting.",
      "Singles convert when organized: top loaders + clear labels + condition grading notes.",
      "Try weekly featured binder pages online to drive in-store pickup.",
    ],
    source: "Gamer Tavern Scribe Desk",
  },
  {
    id: "news-005",
    title: "Vanguard: Deck Core Bundles Customers Actually Buy",
    excerpt:
      "Instead of listing 60 singles, sell deck cores and let players finish the edges.",
    category: "Vanguard",
    date: "2025-12-07",
    readTime: "3 min",
    image:
      "https://images.unsplash.com/photo-1526406915894-6c228685b616?auto=format&fit=crop&w=1200&q=70",
    content: [
      "Deck cores reduce decision fatigue and speed up checkout.",
      "Price it as: core value + convenience fee (small, but justified).",
      "Offer optional upgrades: triggers, sleeves, deck box, playmat.",
    ],
    source: "Gamer Tavern Scribe Desk",
  },
];

/* ------------------------------------------------------------------ */
/* Tournament Calendar (mock – replace with API later)                 */
/* ------------------------------------------------------------------ */
const TOURNAMENTS = [
  {
    id: "evt-001",
    title: "Friday Night Magic — Commander Pods",
    game: "Magic",
    date: "2025-12-20",
    startTime: "19:30",
    endTime: "22:30",
    location: "Gamer Tavern - Play Area",
    format: "Commander",
    entryFee: "BND 5",
    prize: "Store Credit + Promo",
    notes: "Bring your deck. Pods will be balanced by power level.",
  },
  {
    id: "evt-002",
    title: "Yu-Gi-Oh Locals",
    game: "Yu-Gi-Oh",
    date: "2025-12-22",
    startTime: "20:00",
    endTime: "22:00",
    location: "Gamer Tavern - Play Area",
    format: "Advanced Format",
    entryFee: "BND 5",
    prize: "Top cut store credit",
    notes: "Arrive 15 mins early for registration.",
  },
  {
    id: "evt-003",
    title: "Pokémon League Cup (Mini)",
    game: "Pokemon",
    date: "2025-12-28",
    startTime: "14:00",
    endTime: "18:00",
    location: "Gamer Tavern - Play Area",
    format: "Standard",
    entryFee: "BND 10",
    prize: "Packs + Store Credit",
    notes: "Swiss rounds depending on attendance.",
  },
  {
    id: "evt-004",
    title: "Vanguard Saturday Clash",
    game: "Vanguard",
    date: "2026-01-04",
    startTime: "16:00",
    endTime: "19:00",
    location: "Gamer Tavern - Play Area",
    format: "Standard",
    entryFee: "BND 5",
    prize: "Store credit",
    notes: "Bring sleeves + deck list recommended.",
  },
];

/* ------------------------------------------------------------------ */
/* Demand Candles (mock OHLC – replace with API later)                 */
/* time must be YYYY-MM-DD for lightweight-charts (business day).      */
/* ------------------------------------------------------------------ */
const DEMAND_CANDLES = {
  All: [
    { time: "2025-12-01", open: 78, high: 85, low: 74, close: 82 },
    { time: "2025-12-02", open: 82, high: 88, low: 79, close: 86 },
    { time: "2025-12-03", open: 86, high: 90, low: 81, close: 84 },
    { time: "2025-12-04", open: 84, high: 89, low: 80, close: 87 },
    { time: "2025-12-05", open: 87, high: 93, low: 85, close: 92 },
    { time: "2025-12-06", open: 92, high: 95, low: 88, close: 90 },
    { time: "2025-12-07", open: 90, high: 94, low: 86, close: 91 },
    { time: "2025-12-08", open: 91, high: 96, low: 89, close: 95 },
    { time: "2025-12-09", open: 95, high: 99, low: 92, close: 97 },
    { time: "2025-12-10", open: 97, high: 100, low: 93, close: 96 },
    { time: "2025-12-11", open: 96, high: 98, low: 90, close: 92 },
    { time: "2025-12-12", open: 92, high: 97, low: 89, close: 95 },
    { time: "2025-12-13", open: 95, high: 99, low: 91, close: 94 },
    { time: "2025-12-14", open: 94, high: 98, low: 90, close: 97 },
    { time: "2025-12-15", open: 97, high: 100, low: 93, close: 98 },
  ],
  Magic: [
    { time: "2025-12-01", open: 72, high: 80, low: 70, close: 78 },
    { time: "2025-12-05", open: 78, high: 86, low: 75, close: 84 },
    { time: "2025-12-10", open: 84, high: 90, low: 82, close: 88 },
    { time: "2025-12-15", open: 88, high: 95, low: 86, close: 92 },
  ],
  "Yu-Gi-Oh": [
    { time: "2025-12-01", open: 70, high: 82, low: 68, close: 79 },
    { time: "2025-12-05", open: 79, high: 85, low: 73, close: 76 },
    { time: "2025-12-10", open: 76, high: 88, low: 74, close: 86 },
    { time: "2025-12-15", open: 86, high: 92, low: 83, close: 90 },
  ],
  Pokemon: [
    { time: "2025-12-01", open: 74, high: 83, low: 71, close: 80 },
    { time: "2025-12-05", open: 80, high: 87, low: 77, close: 82 },
    { time: "2025-12-10", open: 82, high: 91, low: 80, close: 89 },
    { time: "2025-12-15", open: 89, high: 97, low: 86, close: 93 },
  ],
  Vanguard: [
    { time: "2025-12-01", open: 60, high: 68, low: 58, close: 66 },
    { time: "2025-12-05", open: 66, high: 71, low: 63, close: 64 },
    { time: "2025-12-10", open: 64, high: 73, low: 62, close: 70 },
    { time: "2025-12-15", open: 70, high: 76, low: 67, close: 74 },
  ],
};

/* ------------------------------------------------------------------ */
/* Trend of Purchases (mock – replace with API later)                  */
/* ------------------------------------------------------------------ */
const PURCHASE_TRENDS = [
  {
    id: "trend-001",
    game: "Magic",
    cardName: "Sol Ring",
    set: "Commander Collection",
    rarity: "Uncommon",
    demandScore: 98,
    purchases7d: 42,
    delta7dPct: 18,
    price: 3.5,
  },
  {
    id: "trend-002",
    game: "Magic",
    cardName: "Cyclonic Rift",
    set: "Return to Ravnica",
    rarity: "Rare",
    demandScore: 91,
    purchases7d: 27,
    delta7dPct: 12,
    price: 18.0,
  },
  {
    id: "trend-003",
    game: "Yu-Gi-Oh",
    cardName: "Ash Blossom & Joyous Spring",
    set: "MACR",
    rarity: "Secret Rare",
    demandScore: 95,
    purchases7d: 31,
    delta7dPct: 9,
    price: 22.0,
  },
  {
    id: "trend-004",
    game: "Pokemon",
    cardName: "Iono",
    set: "Paldea Evolved",
    rarity: "Ultra Rare",
    demandScore: 88,
    purchases7d: 19,
    delta7dPct: -4,
    price: 10.0,
  },
  {
    id: "trend-005",
    game: "Vanguard",
    cardName: "Overdress Core Piece",
    set: "D Series",
    rarity: "RRR",
    demandScore: 82,
    purchases7d: 14,
    delta7dPct: 6,
    price: 6.0,
  },
  {
    id: "trend-006",
    game: "Pokemon",
    cardName: "Charizard ex",
    set: "SV",
    rarity: "Special Illustration",
    demandScore: 93,
    purchases7d: 22,
    delta7dPct: 15,
    price: 55.0,
  },
];

function formatDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function toMonthKey(iso) {
  return iso.slice(0, 7); // YYYY-MM
}

function formatMonth(key) {
  const [y, m] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, 1);
  return dt.toLocaleDateString(undefined, { year: "numeric", month: "long" });
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function buildGoogleCalendarLink({
  title,
  date,
  startTime,
  endTime,
  location,
  details,
}) {
  const [y, m, d] = date.split("-").map(Number);
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);

  const start = new Date(y, m - 1, d, sh, sm, 0);
  const end = new Date(y, m - 1, d, eh, em, 0);

  const toGCal = (dt) => {
    const yyyy = dt.getUTCFullYear();
    const mm = pad2(dt.getUTCMonth() + 1);
    const dd = pad2(dt.getUTCDate());
    const hh = pad2(dt.getUTCHours());
    const mi = pad2(dt.getUTCMinutes());
    const ss = pad2(dt.getUTCSeconds());
    return `${yyyy}${mm}${dd}T${hh}${mi}${ss}Z`;
  };

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${toGCal(start)}/${toGCal(end)}`,
    location: location || "",
    details: details || "",
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function formatMoney(n) {
  if (n == null || Number.isNaN(Number(n))) return "-";
  return `BND ${Number(n).toFixed(2)}`;
}

function candlesToLine(candles) {
  if (!Array.isArray(candles)) return [];
  return candles
    .filter((c) => c && c.time && c.close != null)
    .map((c) => ({ time: c.time, value: Number(c.close) }));
}

function Pill({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-amber-700/40 bg-slate-950/40 px-3 py-1 text-xs font-serif tracking-wide text-amber-200">
      {children}
    </span>
  );
}

function ButtonGhost({ active, children, ...props }) {
  return (
    <button
      {...props}
      className={[
        "rounded-full px-4 py-2 text-sm font-serif transition-all",
        "border border-amber-700/30 bg-slate-950/30 hover:bg-slate-950/50",
        active
          ? "text-amber-200 shadow-[0_0_0_1px_rgba(245,158,11,0.35)]"
          : "text-amber-100/80",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function GamePill({ game }) {
  const cls =
    game === "Magic"
      ? "border-amber-700/50 bg-amber-950/40 text-amber-200"
      : game === "Yu-Gi-Oh"
      ? "border-purple-700/50 bg-purple-950/40 text-purple-100"
      : game === "Pokemon"
      ? "border-emerald-700/50 bg-emerald-950/30 text-emerald-100"
      : game === "Vanguard"
      ? "border-sky-700/50 bg-sky-950/30 text-sky-100"
      : "border-amber-700/40 bg-slate-950/40 text-amber-200";

  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-serif tracking-wide",
        cls,
      ].join(" ")}
    >
      {game}
    </span>
  );
}

function DeltaPill({ pct }) {
  const isUp = (pct ?? 0) >= 0;
  const cls = isUp
    ? "border-emerald-700/40 bg-emerald-950/25 text-emerald-100"
    : "border-rose-700/40 bg-rose-950/25 text-rose-100";
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-serif tracking-wide",
        cls,
      ].join(" ")}
    >
      {isUp ? "▲" : "▼"} {Math.abs(pct ?? 0)}%
    </span>
  );
}

function Modal({ open, onClose, article }) {
  if (!open || !article) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative mx-auto mt-10 w-[92%] max-w-3xl overflow-hidden rounded-2xl border border-amber-900/40 bg-gradient-to-b from-slate-950 via-purple-950/30 to-slate-950 shadow-2xl shadow-purple-900/30">
        <div className="relative">
          <img
            src={article.image}
            alt={article.title}
            className="h-56 w-full object-cover opacity-85"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/10 to-transparent" />
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full border border-amber-700/40 bg-slate-950/60 px-3 py-1 text-xs font-serif text-amber-200 hover:bg-slate-950/80"
          >
            Close
          </button>
          <div className="absolute bottom-4 left-5 right-5">
            <div className="flex flex-wrap gap-2">
              <Pill>{article.category}</Pill>
              <Pill>{formatDate(article.date)}</Pill>
              <Pill>{article.readTime}</Pill>
            </div>
            <h2 className="mt-3 font-serif text-2xl font-bold text-amber-100">
              {article.title}
            </h2>
            <p className="mt-2 text-sm text-amber-100/80">{article.excerpt}</p>
          </div>
        </div>

        <div className="space-y-4 px-6 py-6 text-amber-50/90">
          <p className="text-xs font-serif tracking-wide text-amber-300/80">
            Source: {article.source}
          </p>

          <div className="space-y-3 leading-relaxed">
            {article.content.map((p, idx) => (
              <p key={idx} className="text-sm text-amber-50/90">
                {p}
              </p>
            ))}
          </div>

          <div className="mt-6 rounded-xl border border-amber-800/30 bg-slate-950/40 p-4">
            <p className="text-xs text-amber-200/80">
              Tip: Later, you can replace this modal content with real articles
              fetched from your backend/API.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function DemandLineChart({ data }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);

  const safeLineData = useMemo(() => candlesToLine(data), [data]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      layout: {
        background: { color: "transparent" },
        textColor: "rgba(253, 230, 138, 0.8)",
      },
      grid: {
        vertLines: { color: "rgba(245, 158, 11, 0.12)" },
        horzLines: { color: "rgba(245, 158, 11, 0.10)" },
      },
      rightPriceScale: {
        borderColor: "rgba(245, 158, 11, 0.20)",
      },
      timeScale: {
        borderColor: "rgba(245, 158, 11, 0.20)",
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { color: "rgba(167, 139, 250, 0.25)" },
        horzLine: { color: "rgba(167, 139, 250, 0.25)" },
      },
      handleScroll: true,
      handleScale: true,
    });

    chartRef.current = chart;

    // ✅ v4: addLineSeries, v5: addSeries(LineSeries)
    let lineSeries;
    if (typeof chart.addLineSeries === "function") {
      // v4
      lineSeries = chart.addLineSeries({
        color: "rgba(253, 230, 138, 0.95)",
        lineWidth: 2,
      });
    } else if (typeof chart.addSeries === "function") {
      // v5
      lineSeries = chart.addSeries(LineSeries, {
        color: "rgba(253, 230, 138, 0.95)",
        lineWidth: 2,
      });
    } else {
      console.error("Unsupported lightweight-charts API. Check package version/imports.");
      chart.remove();
      return;
    }

    seriesRef.current = lineSeries;

    const resize = () => {
      const { width } = el.getBoundingClientRect();
      chart.applyOptions({ width, height: 260 });
      chart.timeScale().fitContent();
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current) return;
    seriesRef.current.setData(safeLineData);
    chartRef.current?.timeScale().fitContent();
  }, [safeLineData]);

  return (
    <div
      ref={containerRef}
      className="h-[260px] w-full rounded-xl border border-amber-900/20 bg-gradient-to-b from-slate-950/40 to-purple-950/10"
    />
  );
}

export default function NewsPage() {
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState(null);

  /* Trend filters */
  const TREND_GAMES = ["All", "Magic", "Yu-Gi-Oh", "Pokemon", "Vanguard"];
  const [trendGame, setTrendGame] = useState("All");

  // Line data selector (based on trendGame)
  const candleData = useMemo(() => {
    const key = trendGame === "All" ? "All" : trendGame;
    return DEMAND_CANDLES[key] || DEMAND_CANDLES.All;
  }, [trendGame]);

  // Calendar month state
  const months = useMemo(() => {
    const keys = Array.from(new Set(TOURNAMENTS.map((e) => toMonthKey(e.date))))
      .sort((a, b) => (a < b ? -1 : 1));
    return keys.length
      ? keys
      : [toMonthKey(new Date().toISOString().slice(0, 10))];
  }, []);

  const [activeMonth, setActiveMonth] = useState(months[0]);

  const eventsThisMonth = useMemo(() => {
    return TOURNAMENTS.filter((e) => toMonthKey(e.date) === activeMonth).sort(
      (a, b) => (a.date < b.date ? -1 : 1)
    );
  }, [activeMonth]);

  const featured = useMemo(() => NEWS.find((n) => n.featured) || NEWS[0], []);
  const selectedArticle = useMemo(
    () => NEWS.find((n) => n.id === openId) || null,
    [openId]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return NEWS.filter((n) => {
      const catOk = category === "All" ? true : n.category === category;
      const qOk =
        !q ||
        n.title.toLowerCase().includes(q) ||
        n.excerpt.toLowerCase().includes(q) ||
        n.category.toLowerCase().includes(q);
      return catOk && qOk;
    }).sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [category, query]);

  const trending = useMemo(() => {
    const base =
      trendGame === "All"
        ? PURCHASE_TRENDS
        : PURCHASE_TRENDS.filter((t) => t.game === trendGame);

    // Sort by demandScore first, then purchases7d
    return [...base].sort((a, b) => {
      if (a.demandScore !== b.demandScore) return b.demandScore - a.demandScore;
      return (b.purchases7d ?? 0) - (a.purchases7d ?? 0);
    });
  }, [trendGame]);

  const top3 = trending.slice(0, 3);

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-amber-900/30 bg-gradient-to-r from-slate-950 via-purple-950/30 to-slate-950 shadow-2xl shadow-purple-900/20">
        <div className="absolute inset-0 opacity-25">
          <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-amber-500/30 blur-3xl" />
          <div className="absolute -right-24 -bottom-24 h-72 w-72 rounded-full bg-purple-500/30 blur-3xl" />
        </div>

        <div className="relative p-8 md:p-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="font-serif text-3xl font-bold text-amber-100">
                The Scribe’s Bulletin
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-amber-100/75">
                Updates, market notes, and community highlights across Magic,
                Yu-Gi-Oh, Pokémon, Vanguard, and more.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Pill>Fresh Drops</Pill>
                <Pill>Market Watch</Pill>
                <Pill>Local Meta</Pill>
              </div>
            </div>

            <div className="w-full max-w-md">
              <label className="block text-xs font-serif tracking-wide text-amber-200/80">
                Search the archives
              </label>
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-amber-800/30 bg-slate-950/40 px-3 py-2">
                <span className="text-amber-400/70">⌕</span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search: set, deck, staple, meta…"
                  className="w-full bg-transparent text-sm text-amber-50 placeholder:text-amber-200/40 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="mt-6 flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <ButtonGhost
                key={c}
                active={category === c}
                onClick={() => setCategory(c)}
                type="button"
              >
                {c}
              </ButtonGhost>
            ))}
          </div>
        </div>
      </section>

      {/* Featured */}
      {featured && (
        <section className="grid gap-6 md:grid-cols-2">
          <div className="overflow-hidden rounded-2xl border border-amber-900/30 bg-slate-950/40">
            <img
              src={featured.image}
              alt={featured.title}
              className="h-64 w-full object-cover opacity-90"
            />
          </div>

          <div className="rounded-2xl border border-amber-900/30 bg-gradient-to-b from-slate-950/60 to-purple-950/20 p-7 shadow-xl shadow-purple-900/15">
            <div className="flex flex-wrap gap-2">
              <Pill>Featured</Pill>
              <Pill>{featured.category}</Pill>
              <Pill>{formatDate(featured.date)}</Pill>
              <Pill>{featured.readTime}</Pill>
            </div>

            <h3 className="mt-4 font-serif text-2xl font-bold text-amber-100">
              {featured.title}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-amber-50/85">
              {featured.excerpt}
            </p>

            <button
              onClick={() => setOpenId(featured.id)}
              className="mt-5 inline-flex items-center gap-2 rounded-xl border border-amber-700/40 bg-slate-950/40 px-5 py-2.5 font-serif text-sm font-semibold text-amber-200 hover:bg-slate-950/60"
            >
              Read scroll
              <span className="text-amber-400/80">→</span>
            </button>

            <p className="mt-4 text-xs text-amber-200/60">
              Source: {featured.source}
            </p>
          </div>
        </section>
      )}

      {/* Trend of Purchases */}
      <section className="relative overflow-hidden rounded-2xl border border-amber-900/30 bg-gradient-to-r from-slate-950 via-purple-950/20 to-slate-950 shadow-2xl shadow-purple-900/15">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-amber-500/25 blur-3xl" />
          <div className="absolute -right-24 -bottom-24 h-72 w-72 rounded-full bg-purple-500/25 blur-3xl" />
        </div>

        <div className="relative space-y-6 p-8 md:p-10">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className="font-serif text-2xl font-bold text-amber-100">
                Trend of Purchases
              </h3>
              <p className="mt-2 max-w-2xl text-sm text-amber-100/70">
                A quick view of which singles are moving fastest. This helps
                players see what’s in demand and helps you restock smart.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Pill>Top Movers</Pill>
                <Pill>7-Day Demand</Pill>
                <Pill>Restock Signals</Pill>
              </div>
            </div>

            {/* Game filter */}
            <div className="flex flex-wrap gap-2">
              {TREND_GAMES.map((g) => (
                <ButtonGhost
                  key={g}
                  active={trendGame === g}
                  onClick={() => setTrendGame(g)}
                  type="button"
                >
                  {g}
                </ButtonGhost>
              ))}
            </div>
          </div>

          {/* Line Graph */}
          <div className="rounded-2xl border border-amber-900/25 bg-slate-950/35 p-5 shadow-lg shadow-purple-900/10">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h4 className="font-serif text-lg font-bold text-amber-100">
                  Demand Line
                </h4>
                <p className="mt-1 text-xs text-amber-100/60">
                  Uses the “close” value from your mock OHLC as a single demand
                  line. Replace with real data later.
                </p>
              </div>
              <span className="text-xs font-serif text-amber-200/70">
                View: {trendGame === "All" ? "All Games" : trendGame}
              </span>
            </div>

            <div className="mt-4 rounded-xl border border-amber-900/20 bg-slate-950/30 p-4">
              <DemandLineChart data={candleData} />
            </div>
          </div>

          {/* Top 3 highlights */}
          <div className="grid gap-5 md:grid-cols-3">
            {top3.map((t) => (
              <article
                key={t.id}
                className="rounded-2xl border border-amber-900/25 bg-slate-950/35 shadow-lg shadow-purple-900/10"
              >
                <div className="p-5">
                  <div className="flex items-center justify-between gap-2">
                    <GamePill game={t.game} />
                    <DeltaPill pct={t.delta7dPct} />
                  </div>

                  <h4 className="mt-3 font-serif text-lg font-bold text-amber-100">
                    {t.cardName}
                  </h4>

                  <p className="mt-1 text-xs text-amber-100/65">
                    {t.set} • {t.rarity}
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-amber-900/20 bg-slate-950/30 p-3">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-amber-200/70">
                        Demand Score
                      </p>
                      <p className="mt-1 font-serif text-xl font-bold text-amber-100">
                        {t.demandScore}
                      </p>
                    </div>
                    <div className="rounded-xl border border-amber-900/20 bg-slate-950/30 p-3">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-amber-200/70">
                        Purchases (7d)
                      </p>
                      <p className="mt-1 font-serif text-xl font-bold text-amber-100">
                        {t.purchases7d}
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 text-xs text-amber-200/70">
                    Est. price:{" "}
                    <span className="text-amber-100">{formatMoney(t.price)}</span>
                  </p>
                </div>
              </article>
            ))}
          </div>

          {/* Trending grid list */}
          <div className="rounded-2xl border border-amber-900/25 bg-slate-950/35 shadow-lg shadow-purple-900/10">
            <div className="p-5">
              <div className="mb-3 flex items-end justify-between">
                <h4 className="font-serif text-lg font-bold text-amber-100">
                  Most Demanded Cards
                </h4>
                <p className="text-xs text-amber-100/60">
                  Showing {trending.length} item(s)
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {trending.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-xl border border-amber-900/20 bg-slate-950/30 p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <GamePill game={t.game} />
                      <DeltaPill pct={t.delta7dPct} />
                    </div>

                    <p className="mt-2 font-serif text-sm font-semibold text-amber-100">
                      {t.cardName}
                    </p>
                    <p className="mt-1 text-[11px] text-amber-100/65">
                      {t.set} • {t.rarity}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-100/70">
                      <span>
                        Score: <span className="text-amber-100">{t.demandScore}</span>
                      </span>
                      <span>
                        7d: <span className="text-amber-100">{t.purchases7d}</span>
                      </span>
                      <span className="text-amber-200/70">{formatMoney(t.price)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-xl border border-amber-800/30 bg-slate-950/40 p-4">
                <p className="text-xs text-amber-200/80">
                  Tip: When you connect your real checkout/orders table, compute:{" "}
                  <span className="text-amber-100">purchases7d</span>,{" "}
                  <span className="text-amber-100">delta7dPct</span>, and a{" "}
                  <span className="text-amber-100">demandScore</span> from sales
                  velocity + stock-outs.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tournament Calendar */}
      <section className="relative overflow-hidden rounded-2xl border border-amber-900/30 bg-gradient-to-r from-slate-950 via-purple-950/20 to-slate-950 shadow-2xl shadow-purple-900/15">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute -left-24 -bottom-24 h-72 w-72 rounded-full bg-amber-500/25 blur-3xl" />
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-purple-500/25 blur-3xl" />
        </div>

        <div className="relative p-8 md:p-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className="font-serif text-2xl font-bold text-amber-100">
                Tournament Calendar
              </h3>
              <p className="mt-2 max-w-2xl text-sm text-amber-100/70">
                Upcoming tournaments and weekly gatherings. Add events to your
                calendar so you never miss a round.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Pill>Weekly Play</Pill>
                <Pill>Locals</Pill>
                <Pill>Special Events</Pill>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {months.map((m) => (
                <ButtonGhost
                  key={m}
                  active={activeMonth === m}
                  onClick={() => setActiveMonth(m)}
                  type="button"
                >
                  {formatMonth(m)}
                </ButtonGhost>
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {eventsThisMonth.length === 0 ? (
              <div className="rounded-2xl border border-amber-900/25 bg-slate-950/35 p-5 text-sm text-amber-100/70">
                No tournaments scheduled for this month yet.
              </div>
            ) : (
              eventsThisMonth.map((e) => {
                const details = [
                  `Game: ${e.game}`,
                  `Format: ${e.format}`,
                  `Entry: ${e.entryFee}`,
                  e.prize ? `Prizes: ${e.prize}` : null,
                  e.notes ? `Notes: ${e.notes}` : null,
                ]
                  .filter(Boolean)
                  .join("\n");

                const gcalUrl = buildGoogleCalendarLink({
                  title: `${e.title} (${e.game})`,
                  date: e.date,
                  startTime: e.startTime,
                  endTime: e.endTime,
                  location: e.location,
                  details,
                });

                return (
                  <article
                    key={e.id}
                    className="group overflow-hidden rounded-2xl border border-amber-900/25 bg-slate-950/35 shadow-lg shadow-purple-900/10 transition hover:border-amber-700/40"
                  >
                    <div className="p-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <GamePill game={e.game} />
                        <span className="text-xs text-amber-200/70">
                          {formatDate(e.date)}
                        </span>
                      </div>

                      <h4 className="mt-3 font-serif text-lg font-bold text-amber-100">
                        {e.title}
                      </h4>

                      <div className="mt-2 space-y-1 text-sm text-amber-50/80">
                        <p>
                          <span className="text-amber-200/70">Time:</span>{" "}
                          {e.startTime}–{e.endTime}
                        </p>
                        <p>
                          <span className="text-amber-200/70">Format:</span>{" "}
                          {e.format}
                        </p>
                        <p>
                          <span className="text-amber-200/70">Entry:</span>{" "}
                          {e.entryFee}
                        </p>
                        {e.prize && (
                          <p>
                            <span className="text-amber-200/70">Prizes:</span>{" "}
                            {e.prize}
                          </p>
                        )}
                        <p className="text-amber-50/70">
                          <span className="text-amber-200/70">Location:</span>{" "}
                          {e.location}
                        </p>
                      </div>

                      {e.notes && (
                        <p className="mt-3 rounded-xl border border-amber-900/20 bg-slate-950/30 p-3 text-xs text-amber-100/70">
                          {e.notes}
                        </p>
                      )}

                      <div className="mt-4">
                        <a
                          href={gcalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-xl border border-amber-700/40 bg-slate-950/40 px-4 py-2 font-serif text-xs font-semibold uppercase tracking-[0.18em] text-amber-200 hover:bg-slate-950/60"
                        >
                          + Add to Calendar
                          <span className="text-amber-400/80">→</span>
                        </a>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* News Grid */}
      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <h4 className="font-serif text-xl font-bold text-amber-100">
              Latest Dispatches
            </h4>
            <p className="text-xs text-amber-100/60">
              Showing {filtered.length} item(s)
              {category !== "All" ? ` in ${category}` : ""}.
            </p>
          </div>

          {query.trim() && (
            <button
              onClick={() => setQuery("")}
              className="rounded-lg border border-amber-800/30 bg-slate-950/40 px-3 py-2 text-xs font-serif text-amber-200 hover:bg-slate-950/60"
            >
              Clear search
            </button>
          )}
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((n) => (
            <article
              key={n.id}
              className="group overflow-hidden rounded-2xl border border-amber-900/25 bg-slate-950/35 shadow-lg shadow-purple-900/10 transition hover:border-amber-700/40"
            >
              <div className="relative">
                <img
                  src={n.image}
                  alt={n.title}
                  className="h-44 w-full object-cover opacity-90 transition group-hover:opacity-100"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
                <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                  <Pill>{n.category}</Pill>
                </div>
              </div>

              <div className="p-5">
                <div className="flex items-center gap-2 text-xs text-amber-200/70">
                  <span>{formatDate(n.date)}</span>
                  <span className="opacity-50">•</span>
                  <span>{n.readTime}</span>
                </div>

                <h5 className="mt-2 line-clamp-2 font-serif text-lg font-bold text-amber-100">
                  {n.title}
                </h5>
                <p className="mt-2 line-clamp-3 text-sm text-amber-50/80">
                  {n.excerpt}
                </p>

                <button
                  onClick={() => setOpenId(n.id)}
                  className="mt-4 inline-flex items-center gap-2 text-sm font-serif font-semibold text-amber-200 hover:text-amber-300"
                >
                  Open
                  <span className="transition group-hover:translate-x-0.5">→</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Modal */}
      <Modal
        open={Boolean(openId)}
        article={selectedArticle}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
}
