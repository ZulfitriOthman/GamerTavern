import { CATEGORY_THEME, SEAT_STATE, ACCESSIBLE_GLYPH } from "./seatMapTheme.js";

// Combined legend: ticket categories (color + label) and seat states (glyph + word)
// — every state is legible without color, per the "do not rely on color alone" rule.
export default function SeatLegend() {
  return (
    <div className="flex flex-col gap-3 text-xs text-amber-50/60">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {Object.entries(CATEGORY_THEME).map(([key, theme]) => (
          <span key={key} className="inline-flex items-center gap-1.5">
            <span className={["h-2.5 w-2.5 rounded-full", theme.swatchClass].join(" ")} aria-hidden="true" />
            {theme.label}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {Object.entries(SEAT_STATE).map(([key, state]) => (
          <span key={key} className="inline-flex items-center gap-1.5">
            <span className="flex h-4 w-4 items-center justify-center rounded-[3px] border border-white/20 text-[10px]" aria-hidden="true">
              {state.glyph}
            </span>
            {state.label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="flex h-4 w-4 items-center justify-center rounded-[3px] border border-brand-400 text-[9px] text-brand-300" aria-hidden="true">
            {ACCESSIBLE_GLYPH}
          </span>
          Accessible — within section capacity, not additional
        </span>
      </div>
    </div>
  );
}
