import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Section from "../components/layout/Section.jsx";
import Button from "../components/ui/Button.jsx";
import Modal from "../components/ui/Modal.jsx";
import Pagination from "../components/ui/Pagination.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import ShopHeader from "../components/shop/ShopHeader.jsx";
import ProductSort from "../components/shop/ProductSort.jsx";
import ProductTypeFilter from "../components/shop/ProductTypeFilter.jsx";
import ProductFilters from "../components/shop/ProductFilters.jsx";
import ShopSidebarFilters from "../components/shop/ShopSidebarFilters.jsx";
import ProductGrid from "../components/shop/ProductGrid.jsx";
import ProductGridSkeleton from "../components/shop/ProductGridSkeleton.jsx";
import MarketplaceEmptyState from "../components/shop/MarketplaceEmptyState.jsx";
import FeaturedRail from "../components/shop/FeaturedRail.jsx";
import { useShopCategories } from "../features/shop/useShopCategories.js";
import { useShopProducts, useFeaturedProducts } from "../features/shop/useShopProducts.js";
import { useProductTypes } from "../features/shop/useProductTypes.js";
import { useTcgGames } from "../features/tcg/useTcgGames.js";

function FilterIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path d="M3 5h14M6 10h8M8.5 15h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function ShopPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const searchRef = useRef(null);

  const page = Number(searchParams.get("page")) || 1;
  const search = searchParams.get("q") || "";
  const categoryId = searchParams.get("category") ? Number(searchParams.get("category")) : null;
  const gameId = searchParams.get("game") ? Number(searchParams.get("game")) : null;
  const productTypeId = searchParams.get("type") ? Number(searchParams.get("type")) : null;
  const sort = searchParams.get("sort") || "featured";
  const minPrice = searchParams.get("minPrice") || "";
  const maxPrice = searchParams.get("maxPrice") || "";
  const inStock = searchParams.get("inStock") === "1";

  function updateParams(next) {
    const params = new URLSearchParams(searchParams);
    Object.entries(next).forEach(([key, value]) => {
      if (value === null || value === undefined || value === "" || value === false) {
        params.delete(key);
      } else {
        params.set(key, value === true ? "1" : String(value));
      }
    });
    if (!("page" in next)) params.delete("page");
    setSearchParams(params);
  }

  const { categories } = useShopCategories();
  const { games } = useTcgGames();
  const activeGames = games.filter((g) => !g.status || g.status === "active");
  const { types: productTypes } = useProductTypes();
  // Scoped to the selected category — naturally hides the filter outside a
  // category that has any configured product types (today, only Trading
  // Card Games) without hardcoding a category slug here.
  const availableProductTypes = categoryId ? productTypes.filter((t) => t.category_id === categoryId) : [];

  const filters = useMemo(
    () => ({ search, categoryId, tcgGameId: gameId, productTypeId, sort, page, minPrice, maxPrice, inStock }),
    [search, categoryId, gameId, productTypeId, sort, page, minPrice, maxPrice, inStock]
  );

  const { status, socketStatus, items, pagination, refresh } = useShopProducts(filters);

  const hasActiveFilters = Boolean(search || categoryId || gameId || productTypeId || minPrice || maxPrice || inStock);
  const showFeatured = !hasActiveFilters && page === 1;
  const { status: featuredStatus, items: featuredItems } = useFeaturedProducts(showFeatured);

  const activeFilterCount = [categoryId, gameId, productTypeId, minPrice, maxPrice, inStock].filter(Boolean).length;

  function clearAllFilters() {
    searchRef.current?.clear();
    setSearchParams(new URLSearchParams());
  }

  const isConnecting = socketStatus === "connecting" || (socketStatus === "connected" && status === "loading");
  const isConnectionFailure = socketStatus === "error";

  return (
    <Section spacing="lg" containerSize="xwide" className="pb-24 pt-14 sm:pt-20">
      <ShopHeader ref={searchRef} searchDefaultValue={search} onSearchChange={(value) => updateParams({ q: value })} />

      {showFeatured && !isConnectionFailure ? (
        <div className="mt-8">
          <FeaturedRail status={featuredStatus} items={featuredItems} />
        </div>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-20">
            <ShopSidebarFilters
              categories={categories}
              categoryId={categoryId}
              onCategoryChange={(value) => updateParams({ category: value, type: null })}
              games={activeGames}
              gameId={gameId}
              onGameChange={(value) => updateParams({ game: value })}
              minPrice={minPrice}
              maxPrice={maxPrice}
              onPriceChange={({ minPrice: min, maxPrice: max }) => updateParams({ minPrice: min, maxPrice: max })}
              inStock={inStock}
              onInStockChange={(value) => updateParams({ inStock: value })}
            />
          </div>
        </aside>

        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-amber-50/50">
              {pagination ? `${pagination.total} product${pagination.total === 1 ? "" : "s"}` : ""}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <ProductTypeFilter types={availableProductTypes} value={productTypeId} onChange={(value) => updateParams({ type: value })} />
              <ProductSort value={sort} onChange={(value) => updateParams({ sort: value })} />
              <button
                type="button"
                onClick={() => setFiltersOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-ink-800/60 px-4 py-2.5 text-sm font-medium text-amber-50/80 transition-colors duration-150 hover:border-white/20 hover:text-amber-50 focus-ring lg:hidden"
              >
                <FilterIcon />
                Filters
                {activeFilterCount > 0 ? (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-[11px] font-semibold text-white">
                    {activeFilterCount}
                  </span>
                ) : null}
              </button>
            </div>
          </div>

          {isConnectionFailure ? (
            <ErrorState
              icon="sparkle"
              title="We couldn't load the marketplace"
              description="Check your connection and try again."
              action={
                <Button variant="secondary" onClick={() => window.location.reload()}>
                  Try again
                </Button>
              }
            />
          ) : isConnecting ? (
            <ProductGridSkeleton />
          ) : status === "error" ? (
            <ErrorState
              icon="sparkle"
              title="We couldn't load the marketplace"
              description="Something went wrong loading products."
              action={
                <Button variant="secondary" onClick={refresh}>
                  Try again
                </Button>
              }
            />
          ) : items.length === 0 ? (
            <MarketplaceEmptyState hasActiveFilters={hasActiveFilters} onClearFilters={clearAllFilters} />
          ) : (
            <>
              <ProductGrid products={items} />
              <Pagination pagination={pagination} onPageChange={(p) => updateParams({ page: p })} />
            </>
          )}
        </div>
      </div>

      <Modal open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filters">
        <ProductFilters
          categories={categories}
          initialCategoryId={categoryId}
          games={activeGames}
          initialGameId={gameId}
          initialMinPrice={minPrice}
          initialMaxPrice={maxPrice}
          initialInStock={inStock}
          onApply={(next) => {
            updateParams({
              category: next.categoryId,
              game: next.gameId,
              // A Product Type only ever belongs to one category — clear it
              // whenever category changes via the mobile modal too, so it
              // never lingers as a hidden stale filter (ShopSidebarFilters'
              // desktop category change does the same).
              type: next.categoryId !== categoryId ? null : productTypeId,
              minPrice: next.minPrice,
              maxPrice: next.maxPrice,
              inStock: next.inStock,
            });
            setFiltersOpen(false);
          }}
          onClear={() => {
            updateParams({ category: null, game: null, type: null, minPrice: null, maxPrice: null, inStock: null });
            setFiltersOpen(false);
          }}
        />
      </Modal>
    </Section>
  );
}
