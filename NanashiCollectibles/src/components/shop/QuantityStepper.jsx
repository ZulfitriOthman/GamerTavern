import Icon from "../ui/Icon.jsx";

// Shared, presentational quantity control — ProductDetailPage (min 1, since
// "add to cart" always adds at least one) and CartPage (min 0, since
// decrementing an existing line to 0 is a valid remove — see
// cart.routes.js's PATCH /items/:id) both drive this with their own
// min/max/onChange; this component owns no request/async logic itself.
export default function QuantityStepper({ value, onChange, min = 1, max, disabled = false, size = "md" }) {
  const dims = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <div className={["inline-flex items-center rounded-lg border border-white/10", disabled ? "opacity-50" : ""].join(" ")}>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || value <= min}
        aria-label="Decrease quantity"
        className={[
          "flex items-center justify-center text-amber-50/70 transition-colors duration-150 hover:text-amber-50 disabled:opacity-40 focus-ring",
          dims,
        ].join(" ")}
      >
        <Icon name="minus" className={iconSize} />
      </button>
      <span className="w-8 text-center text-sm font-medium text-amber-50" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(max != null ? Math.min(max, value + 1) : value + 1)}
        disabled={disabled || (max != null && value >= max)}
        aria-label="Increase quantity"
        className={[
          "flex items-center justify-center text-amber-50/70 transition-colors duration-150 hover:text-amber-50 disabled:opacity-40 focus-ring",
          dims,
        ].join(" ")}
      >
        <Icon name="plus" className={iconSize} />
      </button>
    </div>
  );
}
