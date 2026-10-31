import { useState } from "react";
import Button from "../ui/Button.jsx";
import { TextField, SelectField, CheckboxField } from "../ui/Field.jsx";

// Rendered inside a Modal on mobile/tablet (see ShopPage.jsx) — a draft+Apply
// step, unlike the desktop sidebar (ShopSidebarFilters.jsx) which commits
// immediately, since a sheet benefits from an explicit "done adjusting"
// moment. Unmounting on close (Modal's own behavior) is what resets these
// drafts to the committed filters on reopen — no prop-syncing effect needed.
export default function ProductFilters({
  categories,
  initialCategoryId,
  games,
  initialGameId,
  initialMinPrice,
  initialMaxPrice,
  initialInStock,
  onApply,
  onClear,
}) {
  const [categoryId, setCategoryId] = useState(initialCategoryId ? String(initialCategoryId) : "");
  const [gameId, setGameId] = useState(initialGameId ? String(initialGameId) : "");
  const [minPrice, setMinPrice] = useState(initialMinPrice || "");
  const [maxPrice, setMaxPrice] = useState(initialMaxPrice || "");
  const [inStock, setInStock] = useState(Boolean(initialInStock));

  function handleApply() {
    onApply({
      categoryId: categoryId || null,
      gameId: gameId || null,
      minPrice: minPrice || null,
      maxPrice: maxPrice || null,
      inStock,
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <SelectField id="modal-filter-category" label="Category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </SelectField>

      {games.length > 0 ? (
        <SelectField id="modal-filter-game" label="TCG Game" value={gameId} onChange={(e) => setGameId(e.target.value)}>
          <option value="">All games</option>
          {games.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </SelectField>
      ) : null}

      <div>
        <p className="text-sm font-medium text-amber-50/80">Price range (BND)</p>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <TextField
            id="shop-filter-min-price"
            label="Min"
            type="number"
            min="0"
            step="0.01"
            placeholder="0"
            value={minPrice}
            onChange={(event) => setMinPrice(event.target.value)}
          />
          <TextField
            id="shop-filter-max-price"
            label="Max"
            type="number"
            min="0"
            step="0.01"
            placeholder="No limit"
            value={maxPrice}
            onChange={(event) => setMaxPrice(event.target.value)}
          />
        </div>
      </div>

      <CheckboxField id="modal-in-stock" label="In stock only" checked={inStock} onChange={(e) => setInStock(e.target.checked)} />

      <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-4">
        <button
          type="button"
          onClick={() => {
            setCategoryId("");
            setGameId("");
            setMinPrice("");
            setMaxPrice("");
            setInStock(false);
            onClear();
          }}
          className="rounded text-sm text-amber-50/55 hover:text-amber-50 focus-ring"
        >
          Reset
        </button>
        <Button onClick={handleApply}>Apply filters</Button>
      </div>
    </div>
  );
}
