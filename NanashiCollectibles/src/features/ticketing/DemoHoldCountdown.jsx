function formatClock(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Purely local countdown display — no timer state is ever sent anywhere. Real hold
// expiry (TICKET_HOLD_SESSIONS.EXPIRES_AT) is always server-computed; this is a demo
// stand-in for what that UX feels like, and says so explicitly.
export default function DemoHoldCountdown({ seconds }) {
  if (seconds === null) return null;

  return (
    <div className="rounded-lg border border-brand-400/30 bg-brand-500/10 px-4 py-3 text-center">
      <p className="text-xs font-medium uppercase tracking-wide text-brand-300">Seats held for</p>
      <p className="mt-1 font-display text-2xl font-semibold text-amber-50" aria-live="polite">
        {formatClock(seconds)}
      </p>
      <p className="mt-1 text-[11px] text-amber-50/45">Interactive demo — no real reservation has been created.</p>
    </div>
  );
}
