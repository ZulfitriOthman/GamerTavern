import Card from "../ui/Card.jsx";
import Badge from "../ui/Badge.jsx";

export default function TradeListingCard({ listing }) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-sm font-semibold text-amber-50">{listing.title}</h3>
        <Badge tone={listing.type === "sale" ? "gold" : "neutral"} className="shrink-0 text-[10px]">
          {listing.type === "sale" ? "For sale" : "Trade"}
        </Badge>
      </div>

      <p className="text-xs text-amber-50/45">
        {[listing.tcg_game_name, listing.condition].filter(Boolean).join(" · ") || "Trading card game"}
      </p>

      {listing.want ? (
        <p className="text-sm text-amber-50/65">
          <span className="text-amber-50/40">Looking for: </span>
          {listing.want}
        </p>
      ) : null}
    </Card>
  );
}
