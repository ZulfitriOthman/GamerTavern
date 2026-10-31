const RANGES = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "all", label: "All time" },
];

// Drives every range-aware section of the merchant analytics endpoint
// (Gross Sales, Merchant Earnings, Platform Commission, Orders, AOV, the
// sales trend chart, Order breakdown, Top Products). Recent Orders and the
// Payout snapshot deliberately do NOT react to this — see
// Backend/routes/api/admin.routes.js's comment on why.
export default function DateRangeTabs({ value, onChange }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-ink-900/40 p-1" role="tablist" aria-label="Reporting period">
      {RANGES.map((r) => (
        <button
          key={r.value}
          type="button"
          role="tab"
          aria-selected={value === r.value}
          onClick={() => onChange(r.value)}
          className={[
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-150 focus-ring",
            value === r.value ? "bg-brand-500 text-white" : "text-amber-50/60 hover:text-amber-50",
          ].join(" ")}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
