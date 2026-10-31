// Quick browsing filter beside Sort (not duplicated in the sidebar/mobile
// Filters modal — see ShopPage.jsx). Renders nothing when `types` is empty,
// which naturally hides it outside a category that has any configured
// product types (today, only Trading Card Games) — no category-slug check
// needed here, ShopPage already passes only the types matching the
// selected category.
export default function ProductTypeFilter({ types, value, onChange }) {
  if (!types.length) return null;

  return (
    <div className="relative">
      <select
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}
        aria-label="Filter by product type"
        className="w-full appearance-none rounded-lg border border-white/10 bg-ink-900 py-2.5 pl-3.5 pr-9 text-sm text-amber-50 transition-colors duration-150 focus-ring focus:border-brand-400 sm:w-auto"
      >
        <option value="">Product Type: All</option>
        {types.map((type) => (
          <option key={type.id} value={type.id}>
            {type.name}
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
