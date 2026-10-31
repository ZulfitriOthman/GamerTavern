import Button from "../../components/ui/Button.jsx";
import DemoHoldCountdown from "./DemoHoldCountdown.jsx";
import { demoTicketTypes, formatPrice } from "./demoPricing.js";
import { CATEGORY_THEME } from "./seatMapTheme.js";

// The end of the demo flow. Deliberately has no "Pay now" / card entry / place-order
// affordance — this is a service capability showcase, not a real checkout, so the
// only calls to action are restarting the demo or talking to Nanashi about a real
// ticketing setup (via the existing /contact enquiry flow — no new one invented).
export default function DemoCheckoutSummary({ selectedSeats, gaQty, total, remainingSeconds, onReset }) {
  return (
    <div className="mx-auto max-w-md text-center">
      <h4 className="font-display text-lg font-semibold text-amber-50">Booking Demo</h4>
      <p className="mt-1 text-xs text-amber-50/45">Interactive demo — no real reservation has been created.</p>

      <ul className="mt-5 flex flex-col divide-y divide-white/5 text-left">
        {selectedSeats.map((seat) => (
          <li key={seat.code} className="flex items-start justify-between gap-2 py-2 text-sm">
            <div>
              <p className="text-amber-50">
                Section {seat.sectionLabel} · Row {seat.row} · Seat {seat.seatNumber}
              </p>
              <p className={["text-xs", CATEGORY_THEME[seat.category].textClass].join(" ")}>{CATEGORY_THEME[seat.category].label.split(" ")[0]}</p>
            </div>
            <span className="shrink-0 text-amber-50/80">{formatPrice(seat.price)}</span>
          </li>
        ))}
        {gaQty > 0 ? (
          <li className="flex items-start justify-between gap-2 py-2 text-sm">
            <div>
              <p className="text-amber-50">General Admission × {gaQty}</p>
              <p className="text-xs text-signal-400">Standing floor</p>
            </div>
            <span className="shrink-0 text-amber-50/80">{formatPrice(gaQty * demoTicketTypes.general_admission.price)}</span>
          </li>
        ) : null}
      </ul>

      <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
        <span className="text-sm font-medium text-amber-50">Total</span>
        <span className="font-display text-lg font-semibold text-amber-50">{formatPrice(total)}</span>
      </div>

      <div className="mt-5">
        <DemoHoldCountdown seconds={remainingSeconds} />
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
        <Button to="/contact" className="flex-1">
          Talk to us about ticketing
        </Button>
        <Button variant="secondary" onClick={onReset} className="flex-1">
          Restart Demo
        </Button>
      </div>
    </div>
  );
}
