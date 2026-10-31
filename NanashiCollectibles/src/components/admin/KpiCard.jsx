// Small KPI tile for admin financial dashboards. `hint` is optional
// supporting text (e.g. clarifying what the figure does/doesn't include).
export default function KpiCard({ label, value, hint }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-white/10 bg-ink-900/40 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-amber-50/45">{label}</p>
      <p className="font-display text-xl font-semibold text-amber-50">{value}</p>
      {hint ? <p className="text-[11px] text-amber-50/40">{hint}</p> : null}
    </div>
  );
}
