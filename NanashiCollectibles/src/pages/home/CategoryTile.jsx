import { Link } from "react-router-dom";
import SpotlightCard from "../../components/ui/SpotlightCard.jsx";
import Icon from "../../components/ui/Icon.jsx";

// Real category rows only carry {id, name, slug, description} — no image field
// exists yet, so "visual texture" comes from an icon + name-matched accent
// rather than fabricated photography. Falls back to a generic "store" icon
// for any category name that doesn't match a known pattern, so a newly added
// real category never renders blank.
function iconFor(name) {
  const n = (name || "").toLowerCase();
  if (n.includes("trading card") || n.includes("tcg")) return "cards";
  if (n.includes("accessor")) return "layout";
  if (n.includes("collectible")) return "sparkle";
  if (n.includes("gunpla") || n.includes("model")) return "bolt";
  if (n.includes("drone")) return "drone";
  if (n.includes("computer") || n.includes("pc")) return "code";
  return "store";
}

export default function CategoryTile({ category, large = false }) {
  return (
    <SpotlightCard
      as={Link}
      to={`/shop?category=${category.id}`}
      className={["flex flex-col justify-between gap-4", large ? "p-7 sm:min-h-[220px]" : "p-5 sm:min-h-[160px]"].join(" ")}
    >
      <span
        className={[
          "flex items-center justify-center rounded-xl border border-white/10 bg-white/5 text-brand-300",
          large ? "h-12 w-12" : "h-10 w-10",
        ].join(" ")}
      >
        <Icon name={iconFor(category.name)} className={large ? "h-6 w-6" : "h-5 w-5"} />
      </span>
      <div>
        <h3 className={["font-display font-semibold text-amber-50", large ? "text-xl" : "text-base"].join(" ")}>
          {category.name}
        </h3>
        {category.description ? (
          <p className={["mt-1.5 text-amber-50/60", large ? "text-sm" : "line-clamp-2 text-xs"].join(" ")}>
            {category.description}
          </p>
        ) : null}
      </div>
    </SpotlightCard>
  );
}
