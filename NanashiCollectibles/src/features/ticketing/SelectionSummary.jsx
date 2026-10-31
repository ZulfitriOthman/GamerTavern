import { useState } from "react";
import Button from "../../components/ui/Button.jsx";
import { demoTicketTypes, formatPrice, MAX_DEMO_TICKETS } from "./demoPricing.js";

function LineItem({ label, sublabel, price, onRemove }) {
  return (
    <li className="flex items-start justify-between gap-2 py-1.5 text-sm">
      <div>
        <p className="text-amber-50">{label}</p>
        {sublabel ? <p className="text-xs text-amber-50/45">{sublabel}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-amber-50/80">{formatPrice(price)}</span>
        <button type="button" onClick={onRemove} aria-label={`Remove ${label}`} className="rounded px-1 text-amber-50/40 transition-colors duration-150 hover:text-danger-400 focus-ring">
          ×
        </button>
      </div>
    </li>
  );
}

// Running-total / cart panel. Desktop: a sticky sidebar, always fully expanded.
// Mobile/tablet: a sticky bottom bar collapsed to a one-line total by default —
// tapping it expands the full itemized list, so selected seats are always at most
// one tap away without demanding several screens of scrolling.
export default function SelectionSummary({ selectedSeats, gaQty, ticketCount, total, notice, onToggleSeat, onClearGA, onContinue, onReset }) {
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const isEmpty = ticketCount === 0;

  const body = (
    <>
      <div className="flex items-center justify-between">
        <h4 className="font-display text-sm font-semibold text-amber-50">Your selection</h4>
        <button type="button" onClick={onReset} className="text-xs font-medium text-amber-50/50 transition-colors duration-150 hover:text-amber-50 focus-ring rounded">
          Reset demo
        </button>
      </div>

      {isEmpty ? (
        <p className="mt-4 text-sm text-amber-50/45">No tickets selected yet. Tap a section or Standing Floor to begin.</p>
      ) : (
        <ul className="mt-3 flex flex-col divide-y divide-white/5">
          {selectedSeats.map((seat) => (
            <LineItem key={seat.code} label={`${seat.code}`} sublabel={`Row ${seat.row} · Seat ${seat.seatNumber}${seat.accessible ? " · Accessible" : ""}`} price={seat.price} onRemove={() => onToggleSeat(seat)} />
          ))}
          {gaQty > 0 ? (
            <LineItem label={`General Admission × ${gaQty}`} sublabel="Standing floor" price={gaQty * demoTicketTypes.general_admission.price} onRemove={onClearGA} />
          ) : null}
        </ul>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
        <span className="text-sm font-medium text-amber-50">Total</span>
        <span className="font-display text-lg font-semibold text-amber-50">{formatPrice(total)}</span>
      </div>

      <p className="mt-1 text-[11px] text-amber-50/35">
        {ticketCount}/{MAX_DEMO_TICKETS} demo tickets
      </p>

      {notice ? (
        <p role="status" className="mt-2 rounded-lg border border-gold-500/30 bg-gold-500/10 px-3 py-2 text-xs text-gold-300">
          {notice}
        </p>
      ) : null}

      <Button onClick={onContinue} disabled={isEmpty} className="mt-4 w-full">
        Continue
      </Button>
    </>
  );

  return (
    <>
      {/* Desktop / tablet sidebar */}
      <div className="hidden lg:sticky lg:top-4 lg:block lg:h-fit lg:rounded-xl lg:border lg:border-white/10 lg:bg-ink-900/60 lg:p-4">{body}</div>

      {/* Mobile: collapsible sticky bottom sheet */}
      <div className="sticky bottom-0 z-10 -mx-5 mt-4 border-t border-white/10 bg-ink-900/95 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setMobileExpanded((prev) => !prev)}
          aria-expanded={mobileExpanded}
          className="flex w-full items-center justify-between px-5 py-3 text-left"
        >
          <span className="text-sm text-amber-50">
            {ticketCount > 0 ? `${ticketCount} selected · ${formatPrice(total)}` : "No tickets selected"}
          </span>
          <span className="text-xs font-medium text-brand-300">{mobileExpanded ? "Hide" : "View"}</span>
        </button>
        {mobileExpanded ? <div className="px-5 pb-5">{body}</div> : null}
      </div>
    </>
  );
}
