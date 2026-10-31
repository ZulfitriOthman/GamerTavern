// Demo-only seat inventory for the /services/ticketing showcase — deterministic, not
// Math.random() (a random layout would reshuffle on every render/re-mount, which
// isn't what a "realistic demo" should feel like). This is fake, hand-picked data,
// never anything resembling production EVENT_SEATS state.
//
// Seat code convention: {CATEGORY}-{SECTION}-R{row}-S{seat}, e.g. "VIP-A-R01-S01",
// "STD-C-R05-S14" — mirrors VENUE_SEATS.SEAT_CODE's real convention
// (Database/schema/009_ticketing.sql), so this shape survives a later swap to real
// backend seat codes.
const CATEGORY_CODE = { vip: "VIP", standard: "STD" };

export function seatCode(category, sectionKey, rowIndex, seatIndex) {
  const row = String(rowIndex + 1).padStart(2, "0");
  const seat = String(seatIndex + 1).padStart(2, "0");
  return `${CATEGORY_CODE[category]}-${sectionKey}-R${row}-S${seat}`;
}

// A handful of seats per section pre-marked unavailable so the grid doesn't look
// unrealistically empty. Positions are arbitrary/illustrative.
export const DEMO_UNAVAILABLE_SEATS = new Set([
  "VIP-A-R02-S10",
  "VIP-A-R02-S11",
  "VIP-A-R07-S03",
  "VIP-A-R07-S04",
  "VIP-B-R05-S20",
  "VIP-B-R05-S21",
  "VIP-B-R09-S02",
  "STD-C-R08-S20",
  "STD-C-R08-S21",
  "STD-C-R03-S05",
  "STD-D-R10-S15",
  "STD-D-R10-S16",
  "STD-D-R01-S28",
]);

// Accessible positions — metadata on individual seats, counted WITHIN each section's
// 390 capacity, never an addition on top of it. Placed at the aisle-adjacent ends of
// the front row (row 1, first/last seat), matching the venue's central-aisle layout.
export const DEMO_ACCESSIBLE_SEATS = new Set(["VIP-A-R01-S01", "VIP-A-R01-S30", "VIP-B-R01-S01", "VIP-B-R01-S30", "STD-C-R01-S01", "STD-C-R01-S30", "STD-D-R01-S01", "STD-D-R01-S30"]);

// Demo-only General Admission availability out of the 600 standing-floor capacity.
export const DEMO_GA_AVAILABLE = 428;
