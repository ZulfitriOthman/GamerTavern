export function normalizeDbNews(row) {
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

export function normalizeDbTournament(row) {
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

export function normalizeDbDecklist(row) {
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
