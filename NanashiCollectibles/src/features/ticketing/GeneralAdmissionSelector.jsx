import Icon from "../../components/ui/Icon.jsx";
import Button from "../../components/ui/Button.jsx";
import { CATEGORY_THEME } from "./seatMapTheme.js";
import { demoTicketTypes, formatPrice } from "./demoPricing.js";
import { DEMO_GA_AVAILABLE } from "./demoInventory.js";

// General Admission has no individual seats — a quantity stepper against one
// capacity counter, deliberately visually distinct from the reserved-section seat
// grid to demonstrate the platform supports both models (see EVENT_SECTIONS'
// HELD_QUANTITY/SOLD_QUANTITY counters, which this mirrors conceptually).
export default function GeneralAdmissionSelector({ ga, qty, maxAllowed, onIncrement, onDecrement, onCommit, onBack }) {
  const theme = CATEGORY_THEME.general_admission;
  const ticketType = demoTicketTypes.general_admission;
  const canIncrease = qty < maxAllowed && qty < DEMO_GA_AVAILABLE;

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 rounded px-1 text-sm font-medium text-amber-50/70 transition-colors duration-150 hover:text-amber-50 focus-ring"
      >
        <span aria-hidden="true">←</span> Back to venue
      </button>

      <div className="mt-6 flex flex-col items-center gap-6 py-6 text-center">
        <div>
          <p className={["text-xs font-semibold uppercase tracking-wide", theme.textClass].join(" ")}>General Admission</p>
          <h4 className="mt-1 font-display text-xl font-semibold text-amber-50">{ga.label}</h4>
          <p className="mt-1 text-sm text-amber-50/50">Capacity: {ga.capacity.toLocaleString()}</p>
          <p className="text-sm text-amber-50/50">Demo availability: {DEMO_GA_AVAILABLE.toLocaleString()}</p>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-amber-50/40">Quantity</p>
          <div className="mt-2 flex items-center gap-4">
            <button
              type="button"
              onClick={onDecrement}
              disabled={qty <= 0}
              aria-label="Decrease quantity"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-amber-50/70 transition-colors duration-150 hover:text-amber-50 disabled:opacity-30 focus-ring"
            >
              <Icon name="minus" className="h-4 w-4" />
            </button>
            <span className="w-8 text-center text-lg font-semibold text-amber-50" aria-live="polite">
              {qty}
            </span>
            <button
              type="button"
              onClick={onIncrement}
              disabled={!canIncrease}
              aria-label="Increase quantity"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-amber-50/70 transition-colors duration-150 hover:text-amber-50 disabled:opacity-30 focus-ring"
            >
              <Icon name="plus" className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-xs text-amber-50/45">{formatPrice(ticketType.price)} each</p>
        </div>

        <Button onClick={onCommit} disabled={qty <= 0} size="md">
          Add to selection
        </Button>
      </div>
    </div>
  );
}
