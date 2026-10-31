import SpotlightCard from "../ui/SpotlightCard.jsx";
import Badge from "../ui/Badge.jsx";
import Icon from "../ui/Icon.jsx";

function Stat({ label, value }) {
  if (value == null) return null;
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-amber-50/40">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-amber-50/90">{value}</p>
    </div>
  );
}

export default function DecklistCard({ deck }) {
  return (
    <SpotlightCard className="flex flex-col gap-4 p-6">
      <div className="flex items-start justify-between gap-3">
        <Badge tone="gold" className="text-xs">
          {deck.tcg_game_name || "TCG"}
        </Badge>
        {deck.featured ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-300">
            <Icon name="sparkle" className="h-3.5 w-3.5" filled />
            Featured
          </span>
        ) : null}
      </div>

      <div>
        <h3 className="font-display text-base font-semibold text-amber-50">{deck.name}</h3>
        <p className="mt-1 text-sm text-amber-50/55">
          {[deck.archetype, deck.format].filter(Boolean).join(" · ") || "Community decklist"}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 border-t border-white/5 pt-4">
        <Stat label="Win rate" value={deck.win_rate != null ? `${deck.win_rate}%` : "—"} />
        <Stat label="Popularity" value={deck.popularity != null ? deck.popularity : "—"} />
        <Stat label="Avg. cost" value={deck.avg_cost != null ? `$${Number(deck.avg_cost).toFixed(0)}` : "—"} />
      </div>

      {deck.pilot ? <p className="text-xs text-amber-50/40">Piloted by {deck.pilot}</p> : null}
    </SpotlightCard>
  );
}
