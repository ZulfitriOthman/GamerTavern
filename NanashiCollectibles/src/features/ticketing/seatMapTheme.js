// Category -> Nanashi design-token mapping for SeatMap. The source Figma frame used
// amber/gold (VIP), green (Standard), blue (GA), pink (Accessible) — this project's
// palette (tailwind.config.js) has no green or pink token, so categories are adapted
// to the existing semantic set already used by Badge.jsx (gold/signal/neutral) rather
// than introducing one-off colors. Accessible is not a zone color at all (see
// demoVenue.js) — it's a per-seat marker, handled separately in SeatMap.jsx.
export const CATEGORY_THEME = {
  vip: {
    label: "VIP / Premium",
    swatchClass: "bg-gold-500",
    // SVG zone rect (VenueMap.jsx)
    fillClass: "fill-gold-500/20",
    strokeClass: "stroke-gold-400/60",
    activeStrokeClass: "stroke-gold-400",
    textClass: "text-gold-300",
    // HTML seat button (Seat.jsx) — fill/stroke don't apply to a <button>
    seatBgClass: "bg-gold-500/20",
    seatBorderClass: "border-gold-400/50",
  },
  standard: {
    label: "Standard",
    swatchClass: "bg-white/50",
    fillClass: "fill-white/10",
    strokeClass: "stroke-white/25",
    activeStrokeClass: "stroke-white/70",
    textClass: "text-amber-50/80",
    seatBgClass: "bg-white/10",
    seatBorderClass: "border-white/25",
  },
  general_admission: {
    label: "General Admission",
    swatchClass: "bg-signal-500",
    fillClass: "fill-signal-500/20",
    strokeClass: "stroke-signal-400/60",
    activeStrokeClass: "stroke-signal-400",
    textClass: "text-signal-400",
    seatBgClass: "bg-signal-500/20",
    seatBorderClass: "border-signal-400/50",
  },
};

// Per-seat state — layered on top of a seat's category color in Seat.jsx. Never
// color-only: each state also carries a glyph and a word, both rendered in the UI
// (label text, aria-label, title). "Selected" uses brand purple deliberately — the
// one place in this demo a user's own choice, not a category, should read as the
// dominant color.
export const SEAT_STATE = {
  available: { glyph: "○", label: "Available" },
  selected: { glyph: "●", label: "Selected" },
  unavailable: { glyph: "×", label: "Unavailable" },
};

export const ACCESSIBLE_GLYPH = "♿";

