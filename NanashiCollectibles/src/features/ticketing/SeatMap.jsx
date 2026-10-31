import TicketingDemo from "./TicketingDemo.jsx";

// Public entry point for the venue seating experience. `mode="demo"` (the only
// implemented mode) renders the full interactive local-state demo — see
// TicketingDemo.jsx for the component tree and the "no real mutation" guarantee.
//
// A future `mode="booking"` is the intended extension point for the real customer
// ticket-purchase flow (/events/:eventSlug/tickets) — live availability, real
// selection commits, backend-issued holds (TICKET_HOLD_SESSIONS) — but it does not
// exist yet and this component does not implement it. VenueMap, ReservedSectionView,
// GeneralAdmissionSelector and Seat are already plain presentation components driven
// by props, so wiring a booking mode later is additive, not a rewrite.
export default function SeatMap({ venue, mode = "demo" }) {
  if (mode !== "demo") return null;
  return <TicketingDemo venue={venue} />;
}
