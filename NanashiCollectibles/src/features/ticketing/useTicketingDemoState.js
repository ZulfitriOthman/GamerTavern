import { useEffect, useReducer } from "react";
import { demoTicketTypes, MAX_DEMO_TICKETS, DEMO_HOLD_SECONDS } from "./demoPricing.js";

// Local-only UI state for the ticketing demo — selection, GA quantity, current view,
// and the fake hold timer. Nothing here ever touches the network; see
// TicketingDemo.jsx's header comment for the full "no real mutation" guarantee.
//
// The hold countdown is deliberately modeled as a decrementing integer
// (holdSecondsRemaining), not a Date.now()-diffed timestamp — reducers and render
// must stay pure (no Date.now()/Math.random() calls), so "one second has passed" is
// expressed as a TICK_HOLD action dispatched from a setInterval callback (a genuine
// external-system subscription, not a synchronous effect-body setState) rather than
// read from the wall clock during render.
const initialState = {
  view: "venue", // "venue" | "section" | "ga" | "checkout"
  activeSectionKey: null,
  selectedSeats: [], // { code, sectionLabel, category, row, seatNumber, price, accessible }
  gaQty: 0,
  holdSecondsRemaining: null, // null = no hold in progress
  notice: null,
};

function reducer(state, action) {
  switch (action.type) {
    case "ENTER_SECTION":
      return { ...state, view: "section", activeSectionKey: action.key, notice: null };
    case "OPEN_GA":
      return { ...state, view: "ga", notice: null };
    case "BACK_TO_VENUE":
      return { ...state, view: "venue", activeSectionKey: null, notice: null };
    case "TOGGLE_SEAT": {
      const { seat } = action;
      if (seat.unavailable) {
        return { ...state, notice: "This seat is unavailable in this demo." };
      }
      const alreadySelected = state.selectedSeats.some((s) => s.code === seat.code);
      if (alreadySelected) {
        return { ...state, selectedSeats: state.selectedSeats.filter((s) => s.code !== seat.code), notice: null };
      }
      if (state.selectedSeats.length + state.gaQty >= MAX_DEMO_TICKETS) {
        return { ...state, notice: `You've reached the demo limit of ${MAX_DEMO_TICKETS} tickets.` };
      }
      return { ...state, selectedSeats: [...state.selectedSeats, seat], notice: null };
    }
    case "SET_GA_QTY": {
      const maxAllowed = Math.max(0, MAX_DEMO_TICKETS - state.selectedSeats.length);
      const clamped = Math.max(0, Math.min(action.qty, maxAllowed));
      const notice = action.qty > maxAllowed ? `You've reached the demo limit of ${MAX_DEMO_TICKETS} tickets.` : null;
      return { ...state, gaQty: clamped, notice };
    }
    // Delta-based (not the stepper's displayed qty) so two rapid clicks — both
    // dispatched before the first re-render lands the new prop back at the button —
    // each still apply correctly: the reducer reads state.gaQty fresh at reduce
    // time, never a value closed over by the click handler.
    case "ADJUST_GA_QTY": {
      const maxAllowed = Math.max(0, MAX_DEMO_TICKETS - state.selectedSeats.length);
      const next = state.gaQty + action.delta;
      const clamped = Math.max(0, Math.min(next, maxAllowed));
      const notice = next > maxAllowed ? `You've reached the demo limit of ${MAX_DEMO_TICKETS} tickets.` : null;
      return { ...state, gaQty: clamped, notice };
    }
    case "CLEAR_NOTICE":
      return { ...state, notice: null };
    case "START_HOLD":
      return { ...state, view: "checkout", holdSecondsRemaining: DEMO_HOLD_SECONDS, notice: null };
    case "TICK_HOLD":
      if (state.holdSecondsRemaining === null) return state;
      return { ...state, holdSecondsRemaining: Math.max(0, state.holdSecondsRemaining - 1) };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

export function useTicketingDemoState() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const isHolding = state.holdSecondsRemaining !== null;

  useEffect(() => {
    if (!isHolding) return undefined;
    const id = setInterval(() => dispatch({ type: "TICK_HOLD" }), 1000);
    return () => clearInterval(id);
  }, [isHolding]);

  useEffect(() => {
    if (!state.notice) return undefined;
    const id = setTimeout(() => dispatch({ type: "CLEAR_NOTICE" }), 3500);
    return () => clearTimeout(id);
  }, [state.notice]);

  const ticketCount = state.selectedSeats.length + state.gaQty;
  const total = state.selectedSeats.reduce((sum, seat) => sum + seat.price, 0) + state.gaQty * demoTicketTypes.general_admission.price;

  return { state, dispatch, ticketCount, total };
}
