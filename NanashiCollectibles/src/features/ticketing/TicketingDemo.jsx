import { useMemo } from "react";
import Badge from "../../components/ui/Badge.jsx";
import VenueMap from "./VenueMap.jsx";
import ReservedSectionView from "./ReservedSectionView.jsx";
import GeneralAdmissionSelector from "./GeneralAdmissionSelector.jsx";
import SeatLegend from "./SeatLegend.jsx";
import SelectionSummary from "./SelectionSummary.jsx";
import DemoCheckoutSummary from "./DemoCheckoutSummary.jsx";
import { useTicketingDemoState } from "./useTicketingDemoState.js";
import { MAX_DEMO_TICKETS } from "./demoPricing.js";

// Orchestrates the full interactive seat-selection demo:
// VenueMap -> ReservedSectionView | GeneralAdmissionSelector -> SelectionSummary
// -> DemoCheckoutSummary. All state is local (useTicketingDemoState.js) — no
// network calls anywhere in this tree. No real hold, EVENT_SEATS write,
// TICKET_HOLD_SESSIONS row, or order is ever created; the "hold" countdown and
// "Booking Demo" screen are frontend-only simulations, clearly labeled as such.
//
// This is what SeatMap.jsx's `mode="demo"` renders. A future `mode="booking"`
// would need live availability (GET .../availability), real selection commits, and
// backend-issued holds (POST .../holds) instead of useTicketingDemoState — it is not
// implemented, but nothing here should need throwing away to add it: VenueMap/
// ReservedSectionView/GeneralAdmissionSelector/Seat are all presentation components
// that take availability + selection as props, not tied to where that data comes from.
export default function TicketingDemo({ venue }) {
  const { state, dispatch, ticketCount, total } = useTicketingDemoState();

  const activeSection = useMemo(() => venue.sections.find((section) => section.key === state.activeSectionKey) || null, [venue.sections, state.activeSectionKey]);

  const selectedCodesForSection = useMemo(
    () => new Set(state.selectedSeats.filter((seat) => seat.sectionLabel === state.activeSectionKey).map((seat) => seat.code)),
    [state.selectedSeats, state.activeSectionKey]
  );

  function handleEnterZone(zone) {
    if (zone.category === "general_admission") {
      dispatch({ type: "OPEN_GA" });
    } else {
      dispatch({ type: "ENTER_SECTION", key: zone.key });
    }
  }

  function handleToggleSeat(seat) {
    dispatch({ type: "TOGGLE_SEAT", seat });
  }

  function handleBack() {
    dispatch({ type: "BACK_TO_VENUE" });
  }

  const maxGaQty = Math.max(0, MAX_DEMO_TICKETS - state.selectedSeats.length);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone="signal">Interactive Demo</Badge>
        <p className="text-xs text-amber-50/45">Sample availability and pricing. No real tickets are being reserved.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-h-[420px]">
          {state.view === "venue" ? <VenueMap venue={venue} onEnterZone={handleEnterZone} /> : null}

          {state.view === "section" && activeSection ? (
            <ReservedSectionView section={activeSection} selectedCodes={selectedCodesForSection} onToggleSeat={handleToggleSeat} onBack={handleBack} />
          ) : null}

          {state.view === "ga" ? (
            <GeneralAdmissionSelector
              ga={venue.ga}
              qty={state.gaQty}
              maxAllowed={maxGaQty}
              onIncrement={() => dispatch({ type: "ADJUST_GA_QTY", delta: 1 })}
              onDecrement={() => dispatch({ type: "ADJUST_GA_QTY", delta: -1 })}
              onCommit={handleBack}
              onBack={handleBack}
            />
          ) : null}

          {state.view === "checkout" ? (
            <DemoCheckoutSummary selectedSeats={state.selectedSeats} gaQty={state.gaQty} total={total} remainingSeconds={state.holdSecondsRemaining} onReset={() => dispatch({ type: "RESET" })} />
          ) : null}

          {state.view !== "checkout" ? (
            <div className="mt-5">
              <SeatLegend />
            </div>
          ) : null}
        </div>

        {state.view !== "checkout" ? (
          <SelectionSummary
            selectedSeats={state.selectedSeats}
            gaQty={state.gaQty}
            ticketCount={ticketCount}
            total={total}
            notice={state.notice}
            onToggleSeat={handleToggleSeat}
            onClearGA={() => dispatch({ type: "SET_GA_QTY", qty: 0 })}
            onContinue={() => dispatch({ type: "START_HOLD" })}
            onReset={() => dispatch({ type: "RESET" })}
          />
        ) : null}
      </div>
    </div>
  );
}
