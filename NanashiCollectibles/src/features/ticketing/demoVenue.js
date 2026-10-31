// Demo-only venue layout for the /services/ticketing showcase.
//
// Shape deliberately mirrors the real backend schema (Database/schema/009_ticketing.sql:
// VENUE_LAYOUTS.CANVAS_WIDTH/HEIGHT + LAYOUT_ELEMENTS, VENUE_SECTIONS, VENUE_SEATS-style
// ROWS_COUNT/SEATS_PER_ROW) so SeatMap's props can later be fed by a real
// GET /api/ticketing/events/:id/availability response without changing the component —
// see SeatMap.jsx's `mode` prop. This file only ever feeds `mode="demo"`.
//
// Venue geometry (canvas size, stage/wings/FOH/aisles/entries/exits/egress, and each
// zone's position/size) is sourced from the "Concert Seating Map — 2,160 Capacity"
// Figma frame (fileKey aF9kHdbVLISZiOyHCkMw7h, node 2:2), re-read 2026-09-17 —
// coordinates are that frame's "Map Surface" (1120x1020) contents, translated to a
// local origin (root-frame coordinates minus the Map Surface's own x=48/y=128
// offset). This layout is approved; do not redesign it.
//
// Per-section seat GRID (rows/seatsPerRow) is a separate, explicitly configurable
// concern from that venue geometry — the source file's own seat vectors form a real
// 15x26 grid, but 13x30 (still 390) was explicitly approved for the interactive demo
// grid, so it's used here. Either shape is valid; nothing downstream hardcodes it.
export const demoVenue = {
  name: "Concert Layout Demo",
  canvasWidth: 1120,
  canvasHeight: 1020,
  // Non-seat wayfinding geometry — stage, wings, FOH, aisles, entrances/exits, egress.
  elements: [
    { type: "stage", label: "STAGE", x: 260, y: 32, width: 600, height: 104 },
    { type: "wing", label: "SL", x: 146, y: 48, width: 92, height: 72 },
    { type: "wing", label: "SR", x: 882, y: 48, width: 92, height: 72 },
    { type: "foh", label: "FOH", x: 486, y: 342, width: 148, height: 48 },
    { type: "aisle", x: 526, y: 432, width: 68, height: 520 },
    { type: "aisle", x: 24, y: 424, width: 1032, height: 12 },
    { type: "aisle", x: 24, y: 684, width: 1032, height: 12 },
    { type: "aisle", x: 24, y: 944, width: 1032, height: 12 },
    { type: "egress", label: "Egress", x: 8, y: 164, width: 16, height: 788 },
    { type: "egress", label: "Egress", x: 1056, y: 164, width: 16, height: 788 },
    { type: "entry", label: "Entry A", x: 0, y: 138, width: 88, height: 28 },
    { type: "entry", label: "Entry B", x: 1020, y: 138, width: 88, height: 28 },
    { type: "exit", label: "Exit 1", x: 0, y: 964, width: 88, height: 28 },
    { type: "exit", label: "Exit 2", x: 1032, y: 964, width: 88, height: 28 },
  ],
  // General admission — no individual seats (see VENUE_SEATS note above); capacity is
  // tracked as one counter, matching EVENT_SECTIONS.HELD/SOLD_QUANTITY for GA rows.
  ga: {
    key: "ga",
    label: "Standing Floor",
    category: "general_admission",
    capacity: 600,
    x: 260,
    y: 164,
    width: 600,
    height: 252,
  },
  // Section A/B interpreted as VIP, C/D as Standard — per the existing Figma
  // interpretation this demo is built from, not a hardcoded business rule.
  sections: [
    { key: "A", label: "Section A", category: "vip", capacity: 390, rows: 13, seatsPerRow: 30, x: 40, y: 448, width: 478, height: 228 },
    { key: "B", label: "Section B", category: "vip", capacity: 390, rows: 13, seatsPerRow: 30, x: 612, y: 448, width: 478, height: 228 },
    { key: "C", label: "Section C", category: "standard", capacity: 390, rows: 13, seatsPerRow: 30, x: 40, y: 708, width: 478, height: 228 },
    { key: "D", label: "Section D", category: "standard", capacity: 390, rows: 13, seatsPerRow: 30, x: 612, y: 708, width: 478, height: 228 },
  ],
};

export const reservedCapacity = demoVenue.sections.reduce((sum, s) => sum + s.capacity, 0);
export const totalCapacity = reservedCapacity + demoVenue.ga.capacity;
