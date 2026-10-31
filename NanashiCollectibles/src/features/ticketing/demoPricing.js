// Demo-only example pricing for the /services/ticketing seat-selection showcase.
// These are illustrative numbers for demonstrating the platform's capability — NOT
// real Nanashi service prices and NOT a real event's ticket prices. Keep that framing
// visible everywhere this is shown (see SeatLegend.jsx / DemoLabel usage).
export const CURRENCY = "BND";

export const demoTicketTypes = {
  vip: { code: "VIP", label: "VIP Reserved", price: 75 },
  standard: { code: "STANDARD", label: "Standard Reserved", price: 45 },
  general_admission: { code: "GA", label: "General Admission", price: 25 },
};

export function formatPrice(amount) {
  return `${CURRENCY} ${amount}`;
}

// Realistic per-customer demo limit — also demonstrates that the real platform
// supports a per-customer ticket limit (EVENTS.PER_CUSTOMER_LIMIT).
export const MAX_DEMO_TICKETS = 6;

// Local-only fake hold duration.
export const DEMO_HOLD_SECONDS = 10 * 60;
