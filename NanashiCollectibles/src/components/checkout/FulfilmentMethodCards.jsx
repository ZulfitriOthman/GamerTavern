import { formatMoney } from "../../features/shop/format.js";

const TYPE_LABELS = {
  DELIVERY: "Delivery",
  PICKUP: "Pickup",
};

// Fulfilment as an actual card-style choice rather than a plain radio list —
// entirely driven by whatever `methods` the backend eligibility endpoint
// returned (checkout.routes.js GET /fulfilment-methods, itself built from
// SHIPPING_METHODS x MERCHANT_FULFILMENT_METHODS). This component never
// invents Delivery or Pickup — if the backend didn't return a method, no
// card for it exists. `methods` is already pre-filtered to `available`
// ones by the caller. A single available method still renders as one card
// (auto-selected by the caller) so the visual treatment stays consistent
// regardless of how many options exist.
export default function FulfilmentMethodCards({ methods, selectedMethodId, onSelect, className = "" }) {
  return (
    <div className={["grid gap-3", methods.length > 1 ? "sm:grid-cols-2" : "", className].join(" ")}>
      {methods.map((m) => {
        const checked = selectedMethodId === m.id;
        const typeLabel = TYPE_LABELS[m.fulfilmentType] || m.name;
        return (
          <label
            key={m.id}
            className={[
              "flex cursor-pointer flex-col gap-1.5 rounded-xl border p-4 transition-colors duration-150",
              checked ? "border-brand-400 bg-brand-500/5" : "border-white/10 bg-ink-900/40 hover:border-white/20",
            ].join(" ")}
          >
            <span className="flex items-center justify-between gap-2.5">
              <span className="flex items-center gap-2.5">
                <input
                  type="radio"
                  name="fulfilmentMethod"
                  checked={checked}
                  onChange={() => onSelect(m.id)}
                  className="h-4 w-4 shrink-0 border-white/20 bg-ink-900 accent-brand-500 focus-ring"
                />
                <span className="font-medium text-amber-50/90">{typeLabel}</span>
              </span>
              <span className="shrink-0 text-xs text-amber-50/50">{Number(m.base_fee) === 0 ? "Free" : formatMoney(m.base_fee)}</span>
            </span>
            <span className="pl-6 text-sm leading-relaxed text-amber-50/60">{m.description || m.name}</span>
          </label>
        );
      })}
    </div>
  );
}
