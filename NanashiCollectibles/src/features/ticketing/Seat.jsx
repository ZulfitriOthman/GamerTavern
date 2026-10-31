import { CATEGORY_THEME, SEAT_STATE, ACCESSIBLE_GLYPH } from "./seatMapTheme.js";
import { formatPrice } from "./demoPricing.js";

// One demo seat. Always a real <button> — it's genuinely actionable (toggles
// selection), so a native control is correct here, not a decorative <span> (compare
// the read-only sample grid this replaced). Keyboard: natural Tab order + native
// Enter/Space activation; no custom arrow-key grid nav — see SeatMap.jsx notes.
export default function Seat({ sectionLabel, category, row, seatNumber, code, price, unavailable, accessible, selected, onToggle }) {
  const theme = CATEGORY_THEME[category];
  const stateKey = unavailable ? "unavailable" : selected ? "selected" : "available";
  const state = SEAT_STATE[stateKey];

  const label = [
    `Section ${sectionLabel}, Row ${row}, Seat ${seatNumber}`,
    theme.label.split(" ")[0],
    formatPrice(price),
    accessible ? "accessible" : null,
    stateKey,
  ]
    .filter(Boolean)
    .join(", ");

  const title = [`Section ${sectionLabel}`, `Row ${String(row).padStart(2, "0")}`, `Seat ${String(seatNumber).padStart(2, "0")}`, "", theme.label.split(" ")[0], formatPrice(price), "", state.label].join(
    "\n"
  );

  return (
    <button
      type="button"
      onClick={() => onToggle({ code, sectionLabel, category, row, seatNumber, price, unavailable, accessible })}
      aria-label={label}
      aria-pressed={selected}
      title={title}
      className={[
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] border text-[10px] leading-none transition-colors duration-150 focus-ring",
        unavailable ? "cursor-not-allowed border-white/10 bg-white/[0.03] text-amber-50/20" : "cursor-pointer",
        !unavailable && selected ? "border-brand-400 bg-brand-500 text-white" : "",
        !unavailable && !selected ? [theme.seatBgClass, theme.seatBorderClass, theme.textClass].join(" ") : "",
      ].join(" ")}
    >
      {accessible && !unavailable ? ACCESSIBLE_GLYPH : state.glyph}
    </button>
  );
}
