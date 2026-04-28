import { useEffect, useMemo, useRef, useState } from "react";
import { getSocket, connectSocket } from "../socket/socketClient";
import { getUsername, getCurrentUser } from "../authStorage";

const CATEGORIES = ["All", "Magic", "Yu-Gi-Oh", "Pokemon", "Vanguard", "General"];

// --- DB row normalizers ---
function normalizeDbNews(row) {
  if (!row) return null;
  const rawContent = row.content || "";
  const paragraphs = rawContent
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  const excerpt =
    rawContent.length > 180
      ? rawContent.slice(0, 180).replace(/\s+\S*$/, "") + "\u2026"
      : rawContent;

  const words = rawContent.split(/\s+/).length;
  const readMin = Math.max(1, Math.round(words / 200));

  const rawDate = row.date_posted || row.created_at;
  const date = rawDate
    ? new Date(rawDate).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  return {
    id: `db-news-${row.id}`,
    dbId: row.id,
    title: row.title || "Untitled",
    excerpt,
    category: row.category || "General",
    date: date,
    rawContent,
    readTime: `${readMin} min`,
    featured: false,
    image:
      row.image_url ||
      "https://images.unsplash.com/photo-1612036781124-847f8939c3f3?auto=format&fit=crop&w=1200&q=70",
    content: paragraphs.length ? paragraphs : [rawContent],
    source: row.author || "Gamer Tavern Scribe Desk",
    tags: row.tags || "",
  };
}

function normalizeDbTournament(row) {
  if (!row) return null;

  const parseDt = (val) => {
    if (!val) return null;
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const startDt = parseDt(row.start_date);
  const endDt = parseDt(row.end_date);

  const _pad = (n) => String(n).padStart(2, "0");
  const date = startDt
    ? `${startDt.getFullYear()}-${_pad(startDt.getMonth() + 1)}-${_pad(startDt.getDate())}`
    : new Date().toISOString().slice(0, 10);
  const startTime = startDt ? `${_pad(startDt.getHours())}:${_pad(startDt.getMinutes())}` : "00:00";
  const endTime = endDt ? `${_pad(endDt.getHours())}:${_pad(endDt.getMinutes())}` : "00:00";
  const fee = row.entry_fee != null ? `BND ${Number(row.entry_fee).toFixed(2)}` : "Free";

  return {
    id: `db-evt-${row.id}`,
    dbId: row.id,
    title: row.name || "Untitled Event",
    game: row.game_title || "General",
    date,
    startTime,
    endTime,
    location: row.location || "Gamer Tavern",
    format: row.rules ? row.rules.slice(0, 80) : "",
    entryFee: fee,
    prize: "",
    notes: row.description || "",
    maxTeams: row.max_teams != null ? Number(row.max_teams) : null,
    participants: Array.isArray(row.participants)
      ? row.participants.map((p) => ({
          id: p.id,
          userId: p.user_id,
          name:
            p.user_name ||
            p.guest_name ||
            p.nickname ||
            (p.user_id ? `User #${p.user_id}` : "Guest"),
          nickname: p.nickname || "",
          teamName: p.team_name || "",
          role: String(p.user_role || (p.user_id ? "USER" : "GUEST")).toUpperCase(),
        }))
      : [],
    _raw: row,
  };
}

function normalizeDbDecklist(row) {
  if (!row) return null;
  const keyCards = String(row.key_cards || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    id: `db-deck-${row.id}`,
    dbId: row.id,
    name: row.name || "Untitled Deck",
    game: row.game || "General",
    archetype: row.archetype || "",
    format: row.format || "",
    pilot: row.pilot || "",
    description: row.description || "",
    keyCards,
    winRate: row.win_rate != null ? Number(row.win_rate) : 0,
    popularity: row.popularity != null ? Number(row.popularity) : 0,
    avgCost: row.avg_cost != null ? Number(row.avg_cost) : 0,
    featured: row.featured ? true : false,
    _raw: row,
  };
}

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

function NewsEditor({ open, initial, onClose, onSave, saving, error }) {
  const isEdit = Boolean(initial?.dbId);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("General");
  const [imageUrl, setImageUrl] = useState("");
  const [tags, setTags] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title || "");
    setCategory(initial?.category || "General");
    setImageUrl(
      initial?.image && !initial.image.startsWith("https://images.unsplash.com")
        ? initial.image
        : "",
    );
    setTags(initial?.tags || "");
    setContent(initial?.rawContent ?? (initial?.content || []).join("\n\n"));
  }, [open, initial]);

  if (!open) return null;

  const submit = (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    onSave({
      id: initial?.dbId,
      title: title.trim(),
      category,
      imageUrl: imageUrl.trim(),
      tags: tags.trim(),
      content: content.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-[70]">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <form
        onSubmit={submit}
        className="relative mx-auto mt-10 w-[92%] max-w-2xl space-y-4 overflow-hidden rounded-2xl border border-amber-900/40 bg-gradient-to-b from-slate-950 via-purple-950/30 to-slate-950 p-6 shadow-2xl shadow-purple-900/30"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-xl font-bold text-amber-100">
            {isEdit ? "Edit Article" : "New Article"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-amber-700/40 bg-slate-950/60 px-3 py-1 text-xs font-serif text-amber-200 hover:bg-slate-950/80"
          >
            Close
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-2 text-sm text-red-200">
            ⚠️ {error}
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
            Title
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
            >
              {CATEGORIES.filter((c) => c !== "All").map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
              Tags (comma separated)
            </label>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
            Image URL (optional)
          </label>
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://…"
            className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
            Content (separate paragraphs with blank lines)
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            rows={8}
            className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-amber-900/30 bg-slate-950/40 px-4 py-2 font-serif text-sm text-amber-100/80 hover:bg-slate-950/60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl border border-amber-600/50 bg-gradient-to-r from-amber-950/60 to-purple-950/60 px-5 py-2 font-serif text-sm font-bold text-amber-100 shadow-lg shadow-amber-900/20 hover:border-amber-500/80 disabled:opacity-50"
          >
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Article"}
          </button>
        </div>
      </form>
    </div>
  );
}

const TOURNAMENT_GAMES = ["Magic", "Yu-Gi-Oh", "Pokemon", "Vanguard", "General"];

function TournamentEditor({ open, initial, onClose, onSave, saving, error }) {
  const isEdit = Boolean(initial?.dbId);
  const [name, setName] = useState("");
  const [game, setGame] = useState("General");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("18:00");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("21:00");
  const [entryFee, setEntryFee] = useState("");
  const [maxTeams, setMaxTeams] = useState("");
  const [regDeadline, setRegDeadline] = useState("");
  const [organizer, setOrganizer] = useState("");
  const [rules, setRules] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) return;
    const raw = initial?._raw || {};
    const startDt = raw.start_date ? new Date(raw.start_date) : null;
    const endDt = raw.end_date ? new Date(raw.end_date) : null;
    const regDt = raw.registration_deadline
      ? new Date(raw.registration_deadline)
      : null;
    const pad = (n) => String(n).padStart(2, "0");
    const toDateStr = (d) =>
      d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : "";
    const toTimeStr = (d) =>
      d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : "";

    setName(initial?.title || raw.name || "");
    setGame(initial?.game || raw.game_title || "General");
    setLocation(initial?.location || raw.location || "");
    setStartDate(toDateStr(startDt) || initial?.date || "");
    setStartTime(toTimeStr(startDt) || initial?.startTime || "18:00");
    setEndDate(toDateStr(endDt) || initial?.date || "");
    setEndTime(toTimeStr(endDt) || initial?.endTime || "21:00");
    setEntryFee(raw.entry_fee != null ? String(raw.entry_fee) : "");
    setMaxTeams(raw.max_teams != null ? String(raw.max_teams) : "");
    setRegDeadline(regDt ? toDateStr(regDt) : "");
    setOrganizer(raw.organizer || "");
    setRules(raw.rules || initial?.format || "");
    setDescription(raw.description || initial?.notes || "");
  }, [open, initial]);

  if (!open) return null;

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim() || !startDate) return;

    const buildIso = (d, t) => (d ? `${d}T${t || "00:00"}:00` : "");

    onSave({
      id: initial?.dbId,
      name: name.trim(),
      gameTitle: game,
      location: location.trim(),
      startDate: buildIso(startDate, startTime),
      endDate: endDate ? buildIso(endDate, endTime) : "",
      entryFee: entryFee.trim(),
      maxTeams: maxTeams.trim(),
      registrationDeadline: regDeadline ? `${regDeadline}T23:59:00` : "",
      organizer: organizer.trim(),
      rules: rules.trim(),
      description: description.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-[70]">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <form
        onSubmit={submit}
        className="relative mx-auto mt-10 max-h-[88vh] w-[92%] max-w-2xl space-y-4 overflow-y-auto rounded-2xl border border-amber-900/40 bg-gradient-to-b from-slate-950 via-purple-950/30 to-slate-950 p-6 shadow-2xl shadow-purple-900/30"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-xl font-bold text-amber-100">
            {isEdit ? "Edit Tournament" : "New Tournament"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-amber-700/40 bg-slate-950/60 px-3 py-1 text-xs font-serif text-amber-200 hover:bg-slate-950/80"
          >
            Close
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-2 text-sm text-red-200">
            ⚠️ {error}
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
            Name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
              Game
            </label>
            <select
              value={game}
              onChange={(e) => setGame(e.target.value)}
              className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
            >
              {TOURNAMENT_GAMES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
              Location
            </label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
              Start Time
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
              End Time
            </label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
              Entry Fee (BND)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={entryFee}
              onChange={(e) => setEntryFee(e.target.value)}
              placeholder="0 = Free"
              className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
              Max Teams
            </label>
            <input
              type="number"
              min="0"
              value={maxTeams}
              onChange={(e) => setMaxTeams(e.target.value)}
              className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
              Reg. Deadline
            </label>
            <input
              type="date"
              value={regDeadline}
              onChange={(e) => setRegDeadline(e.target.value)}
              className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
            Organizer
          </label>
          <input
            value={organizer}
            onChange={(e) => setOrganizer(e.target.value)}
            placeholder="Defaults to your admin name"
            className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
            Format / Rules
          </label>
          <textarea
            value={rules}
            onChange={(e) => setRules(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
            Description / Notes
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-amber-900/30 bg-slate-950/40 px-4 py-2 font-serif text-sm text-amber-100/80 hover:bg-slate-950/60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl border border-amber-600/50 bg-gradient-to-r from-amber-950/60 to-purple-950/60 px-5 py-2 font-serif text-sm font-bold text-amber-100 shadow-lg shadow-amber-900/20 hover:border-amber-500/80 disabled:opacity-50"
          >
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Tournament"}
          </button>
        </div>
      </form>
    </div>
  );
}

const DECK_GAMES = ["Magic", "Yu-Gi-Oh", "Pokemon", "Vanguard", "General"];

function GuestJoinModal({ open, tournament, onClose, onSubmit, saving, error }) {
  const [name, setName] = useState("");
  const [teamName, setTeamName] = useState("");

  useEffect(() => {
    if (!open) return;
    setName("");
    setTeamName("");
  }, [open]);

  if (!open || !tournament) return null;

  const submit = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit({
      guestName: trimmed.slice(0, 100),
      teamName: teamName.trim().slice(0, 255),
    });
  };

  return (
    <div className="fixed inset-0 z-[70]">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={saving ? undefined : onClose}
      />
      <form
        onSubmit={submit}
        className="relative mx-auto mt-16 w-[92%] max-w-md space-y-4 overflow-hidden rounded-2xl border border-amber-900/40 bg-gradient-to-b from-slate-950 via-purple-950/30 to-slate-950 p-6 shadow-2xl shadow-purple-900/30"
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />

        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-serif text-[10px] uppercase tracking-[0.3em] text-amber-300/70">
              ❖ Join as Guest
            </p>
            <h3 className="mt-1 font-serif text-xl font-bold text-amber-100">
              {tournament.title}
            </h3>
            <p className="mt-1 text-xs italic text-amber-100/60">
              {formatDate(tournament.date)} · {tournament.startTime}–{tournament.endTime}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-full border border-amber-700/40 bg-slate-950/60 px-3 py-1 text-xs font-serif text-amber-200 hover:bg-slate-950/80 disabled:opacity-50"
          >
            Close
          </button>
        </div>

        <div className="rounded-xl border border-amber-800/30 bg-slate-950/40 p-3 text-[11px] text-amber-200/80">
          Joining without an account — your name will be visible to everyone on
          the participant list. Sign in if you want to manage your registration
          later.
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-2 text-sm text-red-200">
            ⚠️ {error}
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
            Display Name <span className="text-red-300">*</span>
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
            autoFocus
            placeholder="e.g. Sir Lancelot"
            className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
            Team Name (optional)
          </label>
          <input
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            maxLength={255}
            placeholder="e.g. Tavern Knights"
            className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-amber-900/30 bg-slate-950/40 px-4 py-2 font-serif text-sm text-amber-100/80 hover:bg-slate-950/60 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="rounded-xl border border-amber-600/50 bg-gradient-to-r from-amber-950/60 to-purple-950/60 px-5 py-2 font-serif text-sm font-bold text-amber-100 shadow-lg shadow-amber-900/20 hover:border-amber-500/80 disabled:opacity-50"
          >
            {saving ? "Joining…" : "Join Tournament"}
          </button>
        </div>
      </form>
    </div>
  );
}

function DecklistEditor({ open, initial, onClose, onSave, saving, error }) {
  const isEdit = Boolean(initial?.dbId);
  const [name, setName] = useState("");
  const [game, setGame] = useState("Magic");
  const [archetype, setArchetype] = useState("");
  const [format, setFormat] = useState("");
  const [pilot, setPilot] = useState("");
  const [description, setDescription] = useState("");
  const [keyCards, setKeyCards] = useState("");
  const [winRate, setWinRate] = useState("");
  const [popularity, setPopularity] = useState("");
  const [avgCost, setAvgCost] = useState("");
  const [featured, setFeatured] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name || "");
    setGame(initial?.game || "Magic");
    setArchetype(initial?.archetype || "");
    setFormat(initial?.format || "");
    setPilot(initial?.pilot || "");
    setDescription(initial?.description || "");
    setKeyCards(
      Array.isArray(initial?.keyCards) ? initial.keyCards.join(", ") : "",
    );
    setWinRate(initial?.winRate != null ? String(initial.winRate) : "");
    setPopularity(initial?.popularity != null ? String(initial.popularity) : "");
    setAvgCost(initial?.avgCost != null ? String(initial.avgCost) : "");
    setFeatured(Boolean(initial?.featured));
  }, [open, initial]);

  if (!open) return null;

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim() || !game) return;
    onSave({
      id: initial?.dbId,
      name: name.trim(),
      game,
      archetype: archetype.trim(),
      format: format.trim(),
      pilot: pilot.trim(),
      description: description.trim(),
      keyCards: keyCards.trim(),
      winRate: winRate.trim(),
      popularity: popularity.trim(),
      avgCost: avgCost.trim(),
      featured,
    });
  };

  return (
    <div className="fixed inset-0 z-[70]">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <form
        onSubmit={submit}
        className="relative mx-auto mt-10 max-h-[88vh] w-[92%] max-w-2xl space-y-4 overflow-y-auto rounded-2xl border border-amber-900/40 bg-gradient-to-b from-slate-950 via-purple-950/30 to-slate-950 p-6 shadow-2xl shadow-purple-900/30"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-xl font-bold text-amber-100">
            {isEdit ? "Edit Decklist" : "New Decklist"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-amber-700/40 bg-slate-950/60 px-3 py-1 text-xs font-serif text-amber-200 hover:bg-slate-950/80"
          >
            Close
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-2 text-sm text-red-200">
            ⚠️ {error}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
              Deck Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
              Game
            </label>
            <select
              value={game}
              onChange={(e) => setGame(e.target.value)}
              className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
            >
              {DECK_GAMES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
              Archetype
            </label>
            <input
              value={archetype}
              onChange={(e) => setArchetype(e.target.value)}
              placeholder="Aggro / Combo / Control…"
              className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
              Format
            </label>
            <input
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              placeholder="Standard / Pioneer / Advanced…"
              className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
              Pilot
            </label>
            <input
              value={pilot}
              onChange={(e) => setPilot(e.target.value)}
              className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
            Key Cards (comma separated)
          </label>
          <input
            value={keyCards}
            onChange={(e) => setKeyCards(e.target.value)}
            placeholder="Sol Ring, Lightning Bolt, …"
            className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
              Win Rate (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={winRate}
              onChange={(e) => setWinRate(e.target.value)}
              className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
              Popularity
            </label>
            <input
              type="number"
              min="0"
              value={popularity}
              onChange={(e) => setPopularity(e.target.value)}
              className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
              Avg Cost (BND)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={avgCost}
              onChange={(e) => setAvgCost(e.target.value)}
              className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm font-serif text-amber-100/80">
          <input
            type="checkbox"
            checked={featured}
            onChange={(e) => setFeatured(e.target.checked)}
            className="h-4 w-4 rounded border-amber-700/40 bg-slate-900 accent-amber-500"
          />
          Mark as ★ Spotlight (featured deck)
        </label>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-amber-900/30 bg-slate-950/40 px-4 py-2 font-serif text-sm text-amber-100/80 hover:bg-slate-950/60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl border border-amber-600/50 bg-gradient-to-r from-amber-950/60 to-purple-950/60 px-5 py-2 font-serif text-sm font-bold text-amber-100 shadow-lg shadow-amber-900/20 hover:border-amber-500/80 disabled:opacity-50"
          >
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Decklist"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function NewsPage() {
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState(null);

  // Admin
  const currentUser = getCurrentUser();
  const isAdmin =
    String(currentUser?.role || "").toUpperCase() === "ADMIN";
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState(null);
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorError, setEditorError] = useState("");

  // Tournament admin editor
  const [tEditorOpen, setTEditorOpen] = useState(false);
  const [editingTournament, setEditingTournament] = useState(null);
  const [tEditorSaving, setTEditorSaving] = useState(false);
  const [tEditorError, setTEditorError] = useState("");

  // Decklist admin editor
  const [dEditorOpen, setDEditorOpen] = useState(false);
  const [editingDecklist, setEditingDecklist] = useState(null);
  const [dEditorSaving, setDEditorSaving] = useState(false);
  const [dEditorError, setDEditorError] = useState("");

  // Guest-join modal
  const [guestJoinOpen, setGuestJoinOpen] = useState(false);
  const [guestJoinTournament, setGuestJoinTournament] = useState(null);
  const [guestJoinSaving, setGuestJoinSaving] = useState(false);
  const [guestJoinError, setGuestJoinError] = useState("");

  // DB-sourced data
  const [dbNews, setDbNews] = useState([]);
  const [dbTournaments, setDbTournaments] = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [tournamentsLoading, setTournamentsLoading] = useState(false);
  const didInitRef = useRef(false);

  // Active data: from DB
  const news = dbNews;
  const tournaments = dbTournaments;

  // DB decklists (admin-managed)
  const [dbDecklists, setDbDecklists] = useState([]);
  const decklists = dbDecklists;

  /* Decklist filters */
  const TREND_GAMES = ["All", "Magic", "Yu-Gi-Oh", "Pokemon", "Vanguard"];
  const [trendGame, setTrendGame] = useState("All");

  // --- Socket loading ---
  const emitAsync = (event, payload) =>
    new Promise((resolve) => {
      const s = getSocket();
      if (!s?.connected) return resolve({ success: false });
      s.emit(event, payload, (res) => resolve(res));
    });

  const loadNews = async () => {
    setNewsLoading(true);
    const res = await emitAsync("news:list", { limit: 50 });
    setNewsLoading(false);
    if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
      setDbNews(res.data.map(normalizeDbNews).filter(Boolean));
    }
  };

  const loadTournaments = async () => {
    setTournamentsLoading(true);
    const res = await emitAsync("tournament:list", {});
    setTournamentsLoading(false);
    if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
      setDbTournaments(res.data.map(normalizeDbTournament).filter(Boolean));
    }
  };

  const loadDecklists = async () => {
    const res = await emitAsync("decklist:list", {});
    if (res?.success && Array.isArray(res.data)) {
      setDbDecklists(res.data.map(normalizeDbDecklist).filter(Boolean));
    }
  };

  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    connectSocket(getUsername() || "guest");
  }, []);

  useEffect(() => {
    const s = getSocket();
    if (!s) return;

    const onConnect = () => {
      loadNews();
      loadTournaments();
      loadDecklists();
    };

    s.on("connect", onConnect);
    if (s.connected) {
      loadNews();
      loadTournaments();
      loadDecklists();
    }

    return () => {
      s.off("connect", onConnect);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live news mutations from server
  useEffect(() => {
    const s = getSocket();
    if (!s) return;

    const upsert = (row) => {
      const norm = normalizeDbNews(row);
      if (!norm) return;
      setDbNews((prev) => {
        const idx = prev.findIndex((n) => n.dbId === norm.dbId);
        if (idx === -1) return [norm, ...prev];
        const copy = prev.slice();
        copy[idx] = norm;
        return copy;
      });
    };
    const onCreated = (row) => upsert(row);
    const onUpdated = (row) => upsert(row);
    const onDeleted = ({ id }) => {
      setDbNews((prev) => prev.filter((n) => n.dbId !== id));
    };

    s.on("news:created", onCreated);
    s.on("news:updated", onUpdated);
    s.on("news:deleted", onDeleted);
    return () => {
      s.off("news:created", onCreated);
      s.off("news:updated", onUpdated);
      s.off("news:deleted", onDeleted);
    };
  }, []);

  // Live tournament mutations from server
  useEffect(() => {
    const s = getSocket();
    if (!s) return;

    const upsert = (row) => {
      const norm = normalizeDbTournament(row);
      if (!norm) return;
      setDbTournaments((prev) => {
        const idx = prev.findIndex((t) => t.dbId === norm.dbId);
        if (idx === -1) return [...prev, norm];
        const copy = prev.slice();
        copy[idx] = norm;
        return copy;
      });
    };
    const onCreated = (row) => upsert(row);
    const onUpdated = (row) => upsert(row);
    const onDeleted = ({ id }) => {
      setDbTournaments((prev) => prev.filter((t) => t.dbId !== id));
    };

    s.on("tournament:created", onCreated);
    s.on("tournament:updated", onUpdated);
    s.on("tournament:deleted", onDeleted);
    const onParticipantsUpdated = ({ tournament_id, participants }) => {
      setDbTournaments((prev) =>
        prev.map((t) =>
          t.dbId === tournament_id
            ? {
                ...t,
                participants: (participants || []).map((p) => ({
                  id: p.id,
                  userId: p.user_id,
                  name:
                    p.user_name ||
                    p.guest_name ||
                    p.nickname ||
                    (p.user_id ? `User #${p.user_id}` : "Guest"),
                  nickname: p.nickname || "",
                  teamName: p.team_name || "",
                  role: String(
                    p.user_role || (p.user_id ? "USER" : "GUEST"),
                  ).toUpperCase(),
                })),
              }
            : t,
        ),
      );
    };
    s.on("tournament:participants_updated", onParticipantsUpdated);
    return () => {
      s.off("tournament:created", onCreated);
      s.off("tournament:updated", onUpdated);
      s.off("tournament:deleted", onDeleted);
      s.off("tournament:participants_updated", onParticipantsUpdated);
    };
  }, []);

  // Live decklist mutations from server
  useEffect(() => {
    const s = getSocket();
    if (!s) return;

    const upsert = (row) => {
      const norm = normalizeDbDecklist(row);
      if (!norm) return;
      setDbDecklists((prev) => {
        const idx = prev.findIndex((d) => d.dbId === norm.dbId);
        if (idx === -1) return [norm, ...prev];
        const copy = prev.slice();
        copy[idx] = norm;
        return copy;
      });
    };
    const onCreated = (row) => upsert(row);
    const onUpdated = (row) => upsert(row);
    const onDeleted = ({ id }) => {
      setDbDecklists((prev) => prev.filter((d) => d.dbId !== id));
    };

    s.on("decklist:created", onCreated);
    s.on("decklist:updated", onUpdated);
    s.on("decklist:deleted", onDeleted);
    return () => {
      s.off("decklist:created", onCreated);
      s.off("decklist:updated", onUpdated);
      s.off("decklist:deleted", onDeleted);
    };
  }, []);

  // Admin handlers
  const openCreateEditor = () => {
    setEditingArticle(null);
    setEditorError("");
    setEditorOpen(true);
  };
  const openEditEditor = (article) => {
    setEditingArticle(article);
    setEditorError("");
    setEditorOpen(true);
  };
  const closeEditor = () => {
    if (editorSaving) return;
    setEditorOpen(false);
    setEditingArticle(null);
    setEditorError("");
  };

  const handleSaveArticle = async (payload) => {
    if (!isAdmin || !currentUser?.id) {
      setEditorError("Admin privileges required.");
      return;
    }
    setEditorSaving(true);
    setEditorError("");
    const event = payload.id ? "news:update" : "news:create";
    const res = await emitAsync(event, { ...payload, userId: currentUser.id });
    setEditorSaving(false);
    if (!res?.success) {
      setEditorError(res?.message || "Failed to save article.");
      return;
    }
    setEditorOpen(false);
    setEditingArticle(null);
  };

  const handleDeleteArticle = async (article) => {
    if (!isAdmin || !currentUser?.id || !article?.dbId) return;
    if (!window.confirm(`Delete "${article.title}"? This cannot be undone.`)) {
      return;
    }
    const res = await emitAsync("news:delete", {
      id: article.dbId,
      userId: currentUser.id,
    });
    if (!res?.success) {
      window.alert(res?.message || "Failed to delete article.");
    }
  };

  // Tournament admin handlers
  const openCreateTournament = () => {
    setEditingTournament(null);
    setTEditorError("");
    setTEditorOpen(true);
  };
  const openEditTournament = (tournament) => {
    setEditingTournament(tournament);
    setTEditorError("");
    setTEditorOpen(true);
  };
  const closeTournamentEditor = () => {
    if (tEditorSaving) return;
    setTEditorOpen(false);
    setEditingTournament(null);
    setTEditorError("");
  };

  const handleSaveTournament = async (payload) => {
    if (!isAdmin || !currentUser?.id) {
      setTEditorError("Admin privileges required.");
      return;
    }
    setTEditorSaving(true);
    setTEditorError("");
    const event = payload.id ? "tournament:update" : "tournament:create";
    const res = await emitAsync(event, { ...payload, userId: currentUser.id });
    setTEditorSaving(false);
    if (!res?.success) {
      setTEditorError(res?.message || "Failed to save tournament.");
      return;
    }
    setTEditorOpen(false);
    setEditingTournament(null);
  };

  const handleDeleteTournament = async (tournament) => {
    if (!isAdmin || !currentUser?.id || !tournament?.dbId) return;
    if (!window.confirm(`Delete "${tournament.title}"? This cannot be undone.`)) {
      return;
    }
    const res = await emitAsync("tournament:delete", {
      id: tournament.dbId,
      userId: currentUser.id,
    });
    if (!res?.success) {
      window.alert(res?.message || "Failed to delete tournament.");
    }
  };

  const handleJoinTournament = async (tournament) => {
    if (!tournament?.dbId) return;

    if (!currentUser?.id) {
      // Open the guest-join modal instead of a logged-in flow
      setGuestJoinTournament(tournament);
      setGuestJoinError("");
      setGuestJoinOpen(true);
      return;
    }

    const res = await emitAsync("tournament:join", {
      tournamentId: tournament.dbId,
      userId: currentUser.id,
    });
    if (!res?.success) {
      window.alert(res?.message || "Failed to join tournament.");
    }
  };

  const closeGuestJoin = () => {
    if (guestJoinSaving) return;
    setGuestJoinOpen(false);
    setGuestJoinTournament(null);
    setGuestJoinError("");
  };

  const submitGuestJoin = async ({ guestName, teamName }) => {
    if (!guestJoinTournament?.dbId) return;
    setGuestJoinSaving(true);
    setGuestJoinError("");
    const res = await emitAsync("tournament:join", {
      tournamentId: guestJoinTournament.dbId,
      guestName,
      teamName: teamName || undefined,
    });
    setGuestJoinSaving(false);
    if (!res?.success) {
      setGuestJoinError(res?.message || "Failed to join tournament.");
      return;
    }
    setGuestJoinOpen(false);
    setGuestJoinTournament(null);
  };

  const handleLeaveTournament = async (tournament) => {
    if (!currentUser?.id || !tournament?.dbId) return;
    if (!window.confirm(`Leave "${tournament.title}"?`)) return;
    const res = await emitAsync("tournament:leave", {
      tournamentId: tournament.dbId,
      userId: currentUser.id,
    });
    if (!res?.success) {
      window.alert(res?.message || "Failed to leave tournament.");
    }
  };

  const handleRemoveParticipant = async (tournament, participant) => {
    if (!isAdmin || !currentUser?.id || !tournament?.dbId || !participant?.id) return;
    if (!window.confirm(`Remove "${participant.name}" from this tournament?`)) return;
    const res = await emitAsync("tournament:leave", {
      tournamentId: tournament.dbId,
      participantId: participant.id,
      userId: currentUser.id,
    });
    if (!res?.success) {
      window.alert(res?.message || "Failed to remove participant.");
    }
  };

  // Decklist admin handlers
  const openCreateDecklist = () => {
    setEditingDecklist(null);
    setDEditorError("");
    setDEditorOpen(true);
  };
  const openEditDecklist = (deck) => {
    setEditingDecklist(deck);
    setDEditorError("");
    setDEditorOpen(true);
  };
  const closeDecklistEditor = () => {
    if (dEditorSaving) return;
    setDEditorOpen(false);
    setEditingDecklist(null);
    setDEditorError("");
  };

  const handleSaveDecklist = async (payload) => {
    if (!isAdmin || !currentUser?.id) {
      setDEditorError("Admin privileges required.");
      return;
    }
    setDEditorSaving(true);
    setDEditorError("");
    const event = payload.id ? "decklist:update" : "decklist:create";
    const res = await emitAsync(event, { ...payload, userId: currentUser.id });
    setDEditorSaving(false);
    if (!res?.success) {
      setDEditorError(res?.message || "Failed to save decklist.");
      return;
    }
    setDEditorOpen(false);
    setEditingDecklist(null);
  };

  const handleDeleteDecklist = async (deck) => {
    if (!isAdmin || !currentUser?.id || !deck?.dbId) return;
    if (!window.confirm(`Delete "${deck.name}"? This cannot be undone.`)) {
      return;
    }
    const res = await emitAsync("decklist:delete", {
      id: deck.dbId,
      userId: currentUser.id,
    });
    if (!res?.success) {
      window.alert(res?.message || "Failed to delete decklist.");
    }
  };

  // Calendar month state
  const months = useMemo(() => {
    const keys = Array.from(new Set(tournaments.map((e) => toMonthKey(e.date))))
      .sort((a, b) => (a < b ? -1 : 1));
    return keys.length
      ? keys
      : [toMonthKey(new Date().toISOString().slice(0, 10))];
  }, [tournaments]);

  const [activeMonth, setActiveMonth] = useState(() =>
    toMonthKey(new Date().toISOString().slice(0, 10))
  );

  // keep activeMonth in sync if months list changes
  useEffect(() => {
    if (months.length > 0 && !months.includes(activeMonth)) {
      setActiveMonth(months[0]);
    }
  }, [months, activeMonth]);

  const eventsThisMonth = useMemo(() => {
    return tournaments.filter((e) => toMonthKey(e.date) === activeMonth).sort(
      (a, b) => (a.date < b.date ? -1 : 1)
    );
  }, [tournaments, activeMonth]);

  const featured = useMemo(() => news.find((n) => n.featured) || news[0], [news]);
  const selectedArticle = useMemo(
    () => news.find((n) => n.id === openId) || null,
    [news, openId]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return news.filter((n) => {
      const catOk = category === "All" ? true : n.category === category;
      const qOk =
        !q ||
        n.title.toLowerCase().includes(q) ||
        n.excerpt.toLowerCase().includes(q) ||
        n.category.toLowerCase().includes(q);
      return catOk && qOk;
    }).sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [news, category, query]);

  const filteredDecks = useMemo(() => {
    const base =
      trendGame === "All"
        ? decklists
        : decklists.filter((d) => d.game === trendGame);
    return [...base].sort((a, b) => {
      if (a.popularity !== b.popularity) return b.popularity - a.popularity;
      return (b.winRate ?? 0) - (a.winRate ?? 0);
    });
  }, [decklists, trendGame]);

  const featuredDeck = useMemo(
    () => filteredDecks.find((d) => d.featured) || filteredDecks[0] || null,
    [filteredDecks],
  );

  // Decklist pagination (6 per page)
  const DECKS_PER_PAGE = 6;
  const [deckPage, setDeckPage] = useState(1);
  const totalDeckPages = Math.max(
    1,
    Math.ceil(filteredDecks.length / DECKS_PER_PAGE),
  );
  useEffect(() => {
    setDeckPage(1);
  }, [trendGame]);
  useEffect(() => {
    if (deckPage > totalDeckPages) setDeckPage(totalDeckPages);
  }, [deckPage, totalDeckPages]);
  const pagedDecks = useMemo(() => {
    const start = (deckPage - 1) * DECKS_PER_PAGE;
    return filteredDecks.slice(start, start + DECKS_PER_PAGE);
  }, [filteredDecks, deckPage]);

  return (
    <div className="space-y-12">
      {/* Decklist Profile */}
      <section className="relative overflow-hidden rounded-2xl border border-amber-900/30 bg-gradient-to-r from-slate-950 via-purple-950/20 to-slate-950 shadow-2xl shadow-purple-900/15">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-amber-500/25 blur-3xl" />
          <div className="absolute -right-24 -bottom-24 h-72 w-72 rounded-full bg-purple-500/25 blur-3xl" />
        </div>

        <div className="relative space-y-6 p-8 md:p-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="font-serif text-xs uppercase tracking-[0.3em] text-amber-300/70">
                ❖ Decklist Profile
              </p>
              <h3 className="mt-1 font-serif text-3xl font-bold text-amber-100">
                Featured Decklists
              </h3>
              <p className="mt-2 max-w-2xl text-sm italic text-amber-100/70">
                Curated decklists from local pilots — see archetypes, key cards,
                and win rates. Great for inspiration before your next event.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Pill>Top Archetypes</Pill>
                <Pill>Local Pilots</Pill>
                <Pill>Win Rate</Pill>
              </div>
            </div>

            <div className="flex flex-col items-end gap-3">
              {isAdmin && (
                <button
                  type="button"
                  onClick={openCreateDecklist}
                  className="group/dnew rounded-xl border border-amber-600/50 bg-gradient-to-r from-amber-950/60 to-purple-950/60 px-4 py-2.5 font-serif text-xs font-bold uppercase tracking-[0.18em] text-amber-100 shadow-lg shadow-amber-900/20 transition hover:border-amber-500/80 hover:shadow-amber-500/20"
                >
                  <span className="inline-block transition group-hover/dnew:rotate-90">
                    +
                  </span>{" "}
                  New Decklist
                </button>
              )}
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
          </div>

          {/* Featured deck spotlight */}
          {featuredDeck && (
            <div className="relative overflow-hidden rounded-2xl border border-amber-900/30 bg-gradient-to-br from-slate-950/80 via-purple-950/20 to-slate-950/80 p-6 shadow-lg shadow-purple-900/15">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
              <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <GamePill game={featuredDeck.game} />
                    <Pill>{featuredDeck.archetype}</Pill>
                    <Pill>{featuredDeck.format}</Pill>
                    <span className="rounded-full border border-amber-500/50 bg-amber-950/60 px-2.5 py-1 font-serif text-[10px] font-bold uppercase tracking-widest text-amber-200 backdrop-blur">
                      ★ Spotlight
                    </span>
                  </div>
                  <h4 className="font-serif text-2xl font-bold text-amber-100">
                    {featuredDeck.name}
                  </h4>
                  <p className="text-sm italic text-amber-200/70">
                    Piloted by {featuredDeck.pilot}
                  </p>
                  <p className="max-w-2xl text-sm leading-relaxed text-amber-50/80">
                    {featuredDeck.description}
                  </p>

                  <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-amber-200/70">
                      Key Cards
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {featuredDeck.keyCards.map((c) => (
                        <span
                          key={c}
                          className="rounded-full border border-amber-700/40 bg-slate-950/40 px-3 py-1 font-serif text-xs text-amber-100"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid w-full max-w-xs grid-cols-3 gap-3 md:w-auto">
                  <div className="rounded-xl border border-amber-900/25 bg-slate-950/40 p-3 text-center">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-amber-200/70">
                      Win Rate
                    </p>
                    <p className="mt-1 font-serif text-xl font-bold text-amber-100">
                      {featuredDeck.winRate}%
                    </p>
                  </div>
                  <div className="rounded-xl border border-amber-900/25 bg-slate-950/40 p-3 text-center">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-amber-200/70">
                      Meta
                    </p>
                    <p className="mt-1 font-serif text-xl font-bold text-amber-100">
                      {featuredDeck.popularity}
                    </p>
                  </div>
                  <div className="rounded-xl border border-amber-900/25 bg-slate-950/40 p-3 text-center">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-amber-200/70">
                      Avg. Cost
                    </p>
                    <p className="mt-1 font-serif text-xl font-bold text-amber-100">
                      {formatMoney(featuredDeck.avgCost)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Deck grid */}
          <div className="rounded-2xl border border-amber-900/25 bg-slate-950/35 shadow-lg shadow-purple-900/10">
            <div className="p-5">
              <div className="mb-3 flex items-end justify-between">
                <h4 className="font-serif text-lg font-bold text-amber-100">
                  All Decklists
                </h4>
                <p className="text-xs text-amber-100/60">
                  Showing {pagedDecks.length} of {filteredDecks.length} deck(s)
                  {trendGame !== "All" ? ` in ${trendGame}` : ""}
                  {totalDeckPages > 1
                    ? ` · Page ${deckPage}/${totalDeckPages}`
                    : ""}
                </p>
              </div>

              {filteredDecks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-amber-900/40 bg-slate-950/30 p-8 text-center text-sm text-amber-100/70">
                  No decklists yet for {trendGame}.
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {pagedDecks.map((d) => (
                    <article
                      key={d.id}
                      className="group relative overflow-hidden rounded-xl border border-amber-900/25 bg-gradient-to-br from-slate-950/70 to-purple-950/15 p-5 shadow-md shadow-purple-900/10 transition duration-300 hover:-translate-y-1 hover:border-amber-700/60 hover:shadow-lg hover:shadow-amber-900/20"
                    >
                      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent opacity-0 transition group-hover:opacity-100" />
                      <div className="flex items-center justify-between gap-2">
                        <GamePill game={d.game} />
                        <span className="rounded-full border border-amber-700/40 bg-slate-950/40 px-2.5 py-1 text-[10px] font-serif tracking-wide text-amber-200">
                          {d.archetype}
                        </span>
                      </div>

                      <h5 className="mt-3 font-serif text-base font-bold text-amber-100">
                        {d.name}
                      </h5>
                      <p className="mt-0.5 text-[11px] italic text-amber-200/70">
                        {d.format} · {d.pilot}
                      </p>

                      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-amber-50/75">
                        {d.description}
                      </p>

                      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-lg border border-amber-900/20 bg-slate-950/30 p-2">
                          <p className="text-[9px] uppercase tracking-[0.16em] text-amber-200/70">
                            Win
                          </p>
                          <p className="mt-0.5 font-serif text-sm font-bold text-amber-100">
                            {d.winRate}%
                          </p>
                        </div>
                        <div className="rounded-lg border border-amber-900/20 bg-slate-950/30 p-2">
                          <p className="text-[9px] uppercase tracking-[0.16em] text-amber-200/70">
                            Meta
                          </p>
                          <p className="mt-0.5 font-serif text-sm font-bold text-amber-100">
                            {d.popularity}
                          </p>
                        </div>
                        <div className="rounded-lg border border-amber-900/20 bg-slate-950/30 p-2">
                          <p className="text-[9px] uppercase tracking-[0.16em] text-amber-200/70">
                            Cost
                          </p>
                          <p className="mt-0.5 font-serif text-sm font-bold text-amber-100">
                            {formatMoney(d.avgCost)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-amber-200/70">
                          Key Cards
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {d.keyCards.slice(0, 3).map((c) => (
                            <span
                              key={c}
                              className="rounded-full border border-amber-900/30 bg-slate-950/40 px-2 py-0.5 text-[10px] text-amber-100/85"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>

                      {isAdmin && d.dbId && (
                        <div className="mt-4 flex justify-end gap-2 border-t border-amber-900/20 pt-3">
                          <button
                            type="button"
                            onClick={() => openEditDecklist(d)}
                            className="rounded-lg border border-amber-700/40 bg-slate-950/60 px-3 py-1 font-serif text-[11px] text-amber-200 hover:bg-slate-950/80"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteDecklist(d)}
                            className="rounded-lg border border-red-700/40 bg-red-950/40 px-3 py-1 font-serif text-[11px] text-red-200 hover:bg-red-950/60"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}

              {totalDeckPages > 1 && (
                <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDeckPage((p) => Math.max(1, p - 1))}
                    disabled={deckPage === 1}
                    className="rounded-lg border border-amber-800/40 bg-slate-950/40 px-3 py-1.5 font-serif text-xs text-amber-200 hover:bg-slate-950/60 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ← Prev
                  </button>
                  {Array.from({ length: totalDeckPages }, (_, i) => i + 1).map(
                    (p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setDeckPage(p)}
                        className={[
                          "min-w-[2.25rem] rounded-lg border px-3 py-1.5 font-serif text-xs transition",
                          p === deckPage
                            ? "border-amber-500/70 bg-gradient-to-r from-amber-950/70 to-purple-950/70 text-amber-100 shadow-lg shadow-amber-900/20"
                            : "border-amber-900/30 bg-slate-950/40 text-amber-200/80 hover:border-amber-700/50 hover:bg-slate-950/60",
                        ].join(" ")}
                      >
                        {p}
                      </button>
                    ),
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      setDeckPage((p) => Math.min(totalDeckPages, p + 1))
                    }
                    disabled={deckPage === totalDeckPages}
                    className="rounded-lg border border-amber-800/40 bg-slate-950/40 px-3 py-1.5 font-serif text-xs text-amber-200 hover:bg-slate-950/60 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next →
                  </button>
                </div>
              )}
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
              <p className="font-serif text-xs uppercase tracking-[0.3em] text-amber-300/70">
                ❖ Upcoming Battles
              </p>
              <h3 className="mt-1 font-serif text-3xl font-bold text-amber-100">
                Tournament Calendar
              </h3>
              <p className="mt-2 max-w-2xl text-sm italic text-amber-100/70">
                Upcoming tournaments and weekly gatherings. Add events to your
                calendar so you never miss a round.{" "}
                {tournamentsLoading
                  ? "(Loading…)"
                  : dbTournaments.length > 0
                  ? "(Live from DB)"
                  : "(Demo data)"}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Pill>Weekly Play</Pill>
                <Pill>Locals</Pill>
                <Pill>Special Events</Pill>
              </div>
            </div>

            <div className="flex flex-col items-end gap-3">
              {isAdmin && (
                <button
                  onClick={openCreateTournament}
                  className="group/tnew rounded-xl border border-amber-600/50 bg-gradient-to-r from-amber-950/60 to-purple-950/60 px-4 py-2.5 font-serif text-xs font-bold uppercase tracking-[0.18em] text-amber-100 shadow-lg shadow-amber-900/20 transition hover:border-amber-500/80 hover:shadow-amber-500/20"
                  type="button"
                >
                  <span className="inline-block transition group-hover/tnew:rotate-90">
                    +
                  </span>{" "}
                  New Tournament
                </button>
              )}
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
                    className="group relative overflow-hidden rounded-2xl border border-amber-900/25 bg-gradient-to-br from-slate-950/70 to-purple-950/15 shadow-lg shadow-purple-900/10 transition duration-300 hover:-translate-y-1 hover:border-amber-700/60 hover:shadow-xl hover:shadow-amber-900/20"
                  >
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent opacity-0 transition group-hover:opacity-100" />
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
                        {e.format && (
                          <p>
                            <span className="text-amber-200/70">Format:</span>{" "}
                            {e.format}
                          </p>
                        )}
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

                      {/* Participants */}
                      <div className="mt-4 rounded-xl border border-amber-900/20 bg-slate-950/30 p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-serif uppercase tracking-[0.18em] text-amber-200/70">
                            Participants ({e.participants.length}
                            {e.maxTeams ? ` / ${e.maxTeams}` : ""})
                          </p>
                          {currentUser?.id &&
                          e.participants.some((p) => p.userId === currentUser.id) ? (
                            <button
                              type="button"
                              onClick={() => handleLeaveTournament(e)}
                              className="rounded-lg border border-red-700/40 bg-red-950/30 px-2.5 py-1 font-serif text-[10px] uppercase tracking-wider text-red-200 hover:bg-red-950/50"
                            >
                              Leave
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleJoinTournament(e)}
                              disabled={
                                e.maxTeams != null &&
                                e.maxTeams > 0 &&
                                e.participants.length >= e.maxTeams
                              }
                              className="rounded-lg border border-amber-600/50 bg-amber-950/40 px-2.5 py-1 font-serif text-[10px] font-bold uppercase tracking-wider text-amber-100 hover:bg-amber-950/60 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              + {currentUser?.id ? "Join" : "Join as Guest"}
                            </button>
                          )}
                        </div>
                        {e.participants.length === 0 ? (
                          <p className="mt-2 text-[11px] italic text-amber-100/50">
                            No challengers yet — be the first to join!
                          </p>
                        ) : (
                          <ul className="mt-2 flex flex-wrap gap-1.5">
                            {e.participants.map((p) => (
                              <li
                                key={p.id}
                                className={[
                                  "group/part inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-serif",
                                  p.role === "VENDOR"
                                    ? "border-purple-600/50 bg-purple-950/40 text-purple-100"
                                    : p.role === "ADMIN"
                                    ? "border-amber-500/50 bg-amber-950/50 text-amber-100"
                                    : p.role === "GUEST"
                                    ? "border-slate-600/50 bg-slate-900/60 text-slate-200"
                                    : "border-amber-900/40 bg-slate-950/50 text-amber-100/85",
                                ].join(" ")}
                                title={p.teamName || p.nickname || p.name}
                              >
                                {p.role === "VENDOR" && (
                                  <span className="text-[9px]">🏪</span>
                                )}
                                {p.role === "ADMIN" && (
                                  <span className="text-[9px]">★</span>
                                )}
                                {p.role === "GUEST" && (
                                  <span className="text-[9px] uppercase tracking-wider text-slate-400">
                                    👤
                                  </span>
                                )}
                                <span>{p.name}</span>
                                {p.teamName && (
                                  <span className="text-amber-200/70">· {p.teamName}</span>
                                )}
                                {isAdmin && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveParticipant(e, p)}
                                    className="ml-1 rounded-full px-1 text-red-300/80 opacity-0 transition hover:text-red-200 group-hover/part:opacity-100"
                                    title="Remove participant"
                                  >
                                    ×
                                  </button>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

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

                      {isAdmin && e.dbId != null && (
                        <div className="mt-4 flex gap-2 border-t border-amber-900/20 pt-3">
                          <button
                            type="button"
                            onClick={() => openEditTournament(e)}
                            className="flex-1 rounded-lg border border-amber-700/40 bg-slate-950/40 px-3 py-1.5 text-xs font-serif text-amber-200 transition hover:border-amber-500/60 hover:bg-amber-950/30"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTournament(e)}
                            className="flex-1 rounded-lg border border-red-700/40 bg-red-950/30 px-3 py-1.5 text-xs font-serif text-red-200 transition hover:border-red-500/60 hover:bg-red-950/50"
                          >
                            🗑 Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* News Grid */}
      <section className="space-y-5">
        <div className="flex flex-col gap-3 border-b border-amber-900/20 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-serif text-xs uppercase tracking-[0.3em] text-amber-300/70">
              ❖ Archives
            </p>
            <h4 className="mt-1 font-serif text-2xl font-bold text-amber-100">
              Latest Dispatches
            </h4>
            <p className="mt-1 text-xs text-amber-100/60">
              {newsLoading
                ? "Loading…"
                : `Showing ${filtered.length} item(s)${category !== "All" ? ` in ${category}` : ""}${dbNews.length > 0 ? " · Live from DB" : " · Demo data"}.`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={openCreateEditor}
                className="group/new rounded-xl border border-amber-600/50 bg-gradient-to-r from-amber-950/60 to-purple-950/60 px-4 py-2.5 font-serif text-xs font-bold uppercase tracking-[0.18em] text-amber-100 shadow-lg shadow-amber-900/20 transition hover:border-amber-500/80 hover:shadow-amber-500/20"
                type="button"
              >
                <span className="inline-block transition group-hover/new:rotate-90">+</span>{" "}
                New Article
              </button>
            )}
            {query.trim() && (
              <button
                onClick={() => setQuery("")}
                className="rounded-lg border border-amber-800/30 bg-slate-950/40 px-3 py-2 text-xs font-serif text-amber-200 hover:bg-slate-950/60"
              >
                Clear search
              </button>
            )}
          </div>
        </div>

        {!newsLoading && filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-amber-900/40 bg-slate-950/30 p-10 text-center">
            <p className="text-4xl">📜</p>
            <p className="mt-2 font-serif text-amber-100/70">
              No scrolls match your search.
            </p>
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((n) => (
            <article
              key={n.id}
              className="group relative overflow-hidden rounded-2xl border border-amber-900/25 bg-gradient-to-br from-slate-950/70 to-purple-950/10 shadow-lg shadow-purple-900/10 transition duration-300 hover:-translate-y-1 hover:border-amber-700/60 hover:shadow-xl hover:shadow-amber-900/20"
            >
              <div className="absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent opacity-0 transition group-hover:opacity-100" />
              <div className="relative overflow-hidden">
                <img
                  src={n.image}
                  alt={n.title}
                  className="h-44 w-full object-cover opacity-85 transition duration-500 group-hover:scale-110 group-hover:opacity-100"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />
                <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                  <Pill>{n.category}</Pill>
                </div>
                {n.featured && (
                  <span className="absolute right-3 top-3 rounded-full border border-amber-500/50 bg-amber-950/70 px-2.5 py-1 font-serif text-[10px] font-bold uppercase tracking-widest text-amber-200 backdrop-blur">
                    ★
                  </span>
                )}
              </div>

              <div className="p-5">
                <div className="flex items-center gap-2 text-xs text-amber-200/70">
                  <span>📅 {formatDate(n.date)}</span>
                  <span className="opacity-50">❖</span>
                  <span>⏱ {n.readTime}</span>
                </div>

                <h5 className="mt-2 line-clamp-2 font-serif text-lg font-bold leading-snug text-amber-100 transition group-hover:text-amber-50">
                  {n.title}
                </h5>
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-amber-50/75">
                  {n.excerpt}
                </p>

                <button
                  onClick={() => setOpenId(n.id)}
                  className="mt-4 inline-flex items-center gap-2 text-sm font-serif font-semibold text-amber-200 hover:text-amber-300"
                >
                  Open scroll
                  <span className="transition group-hover:translate-x-1">→</span>
                </button>

                {isAdmin && n.dbId != null && (
                  <div className="mt-4 flex gap-2 border-t border-amber-900/20 pt-3">
                    <button
                      type="button"
                      onClick={() => openEditEditor(n)}
                      className="flex-1 rounded-lg border border-amber-700/40 bg-slate-950/40 px-3 py-1.5 text-xs font-serif text-amber-200 transition hover:border-amber-500/60 hover:bg-amber-950/30"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteArticle(n)}
                      className="flex-1 rounded-lg border border-red-700/40 bg-red-950/30 px-3 py-1.5 text-xs font-serif text-red-200 transition hover:border-red-500/60 hover:bg-red-950/50"
                    >
                      🗑 Delete
                    </button>
                  </div>
                )}
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

      {/* Admin editor */}
      {isAdmin && (
        <NewsEditor
          open={editorOpen}
          initial={editingArticle}
          onClose={closeEditor}
          onSave={handleSaveArticle}
          saving={editorSaving}
          error={editorError}
        />
      )}

      {/* Admin tournament editor */}
      {isAdmin && (
        <TournamentEditor
          open={tEditorOpen}
          initial={editingTournament}
          onClose={closeTournamentEditor}
          onSave={handleSaveTournament}
          saving={tEditorSaving}
          error={tEditorError}
        />
      )}

      {/* Admin decklist editor */}
      {isAdmin && (
        <DecklistEditor
          open={dEditorOpen}
          initial={editingDecklist}
          onClose={closeDecklistEditor}
          onSave={handleSaveDecklist}
          saving={dEditorSaving}
          error={dEditorError}
        />
      )}

      {/* Guest join tournament modal */}
      <GuestJoinModal
        open={guestJoinOpen}
        tournament={guestJoinTournament}
        onClose={closeGuestJoin}
        onSubmit={submitGuestJoin}
        saving={guestJoinSaving}
        error={guestJoinError}
      />
    </div>
  );
}
