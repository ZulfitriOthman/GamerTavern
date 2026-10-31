// Matches the `sort` values Backend/controllers/product.controller.js's product:list
// actually implements (including the "featured" sort added for this page — see the
// report). "Best Selling" is intentionally absent: there's no order/sales data behind
// products yet to compute it honestly.
const SORT_OPTIONS = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
];

export default function ProductSort({ value, onChange }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Sort products"
        className="w-full appearance-none rounded-lg border border-white/10 bg-ink-900 py-2.5 pl-3.5 pr-9 text-sm text-amber-50 transition-colors duration-150 focus-ring focus:border-brand-400 sm:w-auto"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            Sort: {option.label}
          </option>
        ))}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-50/40"
      >
        <path d="M5 7.5l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
