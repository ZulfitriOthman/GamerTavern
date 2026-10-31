// Horizontal pill nav — deliberately not the old full-width category cards
// (ShopPage previously spent most of the page on those). Categories come from
// product_categories:list (features/shop/useShopCategories.js), never hardcoded.
function CategoryPill({ active, onClick, children }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={[
        "shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-colors duration-150 focus-ring",
        active
          ? "border-brand-400/50 bg-brand-500/15 text-brand-300"
          : "border-white/10 bg-ink-800/60 text-amber-50/65 hover:border-white/20 hover:text-amber-50",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export default function CategoryNav({ categories, activeCategoryId, onSelect }) {
  return (
    <div
      role="tablist"
      aria-label="Product categories"
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
    >
      <CategoryPill active={!activeCategoryId} onClick={() => onSelect(null)}>
        All Products
      </CategoryPill>
      {categories.map((category) => (
        <CategoryPill key={category.id} active={activeCategoryId === category.id} onClick={() => onSelect(category.id)}>
          {category.name}
        </CategoryPill>
      ))}
    </div>
  );
}
