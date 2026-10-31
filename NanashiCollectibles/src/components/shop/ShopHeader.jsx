import ProductSearch from "./ProductSearch.jsx";

// Deliberately not SectionHeading's "page" size (that's the ~homepage-hero
// scale) — a commerce page's top section is functional, not a marketing
// moment, so this uses a smaller heading and a tighter description/search
// pairing instead of the eyebrow+title+description+gap rhythm every other
// page uses. `ref` is forwarded straight through to ProductSearch (React 19
// ref-as-prop) so ShopPage can call ref.current.clear() on "Clear filters".
export default function ShopHeader({ ref, searchDefaultValue, onSearchChange }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-signal-400">Shop</span>
        <h1 className="mt-1.5 font-display text-2xl font-semibold text-amber-50 sm:text-3xl">
          Trading cards, collectibles, and technology
        </h1>
      </div>
      <div className="sm:w-96 sm:shrink-0">
        <ProductSearch
          ref={ref}
          defaultValue={searchDefaultValue}
          onChange={onSearchChange}
          placeholder="Search products, TCGs, collectibles..."
        />
      </div>
    </div>
  );
}
