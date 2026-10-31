import Badge from "../ui/Badge.jsx";

function excerpt(content, max = 160) {
  const text = (content || "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}

// No dedicated article route exists yet — this is a headline teaser only, not
// a link. Building a full /tcg/news/:slug detail page is a separate, larger
// addition than "surface real news on the hub" calls for.
export default function NewsListItem({ article }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-ink-800/60 p-5">
      <div className="flex flex-wrap items-center gap-2">
        {article.category_name ? <Badge className="text-[10px]">{article.category_name}</Badge> : null}
        {article.tcg_game_name ? (
          <Badge tone="gold" className="text-[10px]">
            {article.tcg_game_name}
          </Badge>
        ) : null}
        <span className="text-xs text-amber-50/40">
          {article.published_at
            ? new Date(article.published_at).toLocaleDateString(undefined, { dateStyle: "medium" })
            : ""}
        </span>
      </div>
      <h3 className="font-display text-base font-semibold text-amber-50">{article.title}</h3>
      {article.content ? <p className="text-sm text-amber-50/60">{excerpt(article.content)}</p> : null}
    </div>
  );
}
