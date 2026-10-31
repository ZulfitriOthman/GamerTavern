import { useState } from "react";
import Card from "../ui/Card.jsx";
import Button from "../ui/Button.jsx";
import { RadioGroupField, TextField, CheckboxField } from "../ui/Field.jsx";

// Desktop-only persistent sidebar (rendered directly in ShopPage's grid, not
// inside a Modal) — every control commits immediately via the callback
// props rather than a draft+Apply step, since there's no modal to dismiss
// here. The mobile equivalent (ProductFilters.jsx, rendered inside a Modal)
// intentionally uses the draft+Apply pattern instead — a sheet benefits from
// an explicit commit moment, a persistent sidebar doesn't.
//
// Only real, backend-supported filters appear here: category and TCG game
// (product_categories / tcg_games — both real tables), price range and
// in-stock (product.controller.js's product:list already implements both).
// "Condition" was deliberately left out — condition_label is free-text on
// the product row, not a fixed vocabulary, so a clean filter list can't be
// built from it honestly without inventing categories the data doesn't have.
export default function ShopSidebarFilters({
  categories,
  categoryId,
  onCategoryChange,
  games,
  gameId,
  onGameChange,
  minPrice,
  maxPrice,
  onPriceChange,
  inStock,
  onInStockChange,
}) {
  const [minDraft, setMinDraft] = useState(minPrice || "");
  const [maxDraft, setMaxDraft] = useState(maxPrice || "");

  function commitPrice() {
    onPriceChange({ minPrice: minDraft || null, maxPrice: maxDraft || null });
  }

  const categoryOptions = [{ value: "", label: "All categories" }, ...categories.map((c) => ({ value: String(c.id), label: c.name }))];
  const gameOptions = [{ value: "", label: "All games" }, ...games.map((g) => ({ value: String(g.id), label: g.name }))];

  return (
    <Card variant="data" className="flex flex-col gap-6">
      <div>
        <p className="text-sm font-semibold text-amber-50/90">Filters</p>
      </div>

      <RadioGroupField
        name="shop-filter-category"
        label="Category"
        options={categoryOptions}
        value={categoryId ? String(categoryId) : ""}
        onChange={(value) => onCategoryChange(value || null)}
      />

      {games.length > 0 ? (
        <RadioGroupField
          name="shop-filter-game"
          label="TCG Game"
          options={gameOptions}
          value={gameId ? String(gameId) : ""}
          onChange={(value) => onGameChange(value || null)}
        />
      ) : null}

      <div>
        <p className="text-sm text-amber-50/70">Price range (BND)</p>
        <div className="mt-2 grid grid-cols-2 gap-2.5">
          <TextField
            id="sidebar-min-price"
            label="Min"
            type="number"
            min="0"
            step="0.01"
            placeholder="0"
            value={minDraft}
            onChange={(e) => setMinDraft(e.target.value)}
            onBlur={commitPrice}
          />
          <TextField
            id="sidebar-max-price"
            label="Max"
            type="number"
            min="0"
            step="0.01"
            placeholder="No limit"
            value={maxDraft}
            onChange={(e) => setMaxDraft(e.target.value)}
            onBlur={commitPrice}
          />
        </div>
      </div>

      <CheckboxField
        id="sidebar-in-stock"
        label="In stock only"
        checked={inStock}
        onChange={(e) => onInStockChange(e.target.checked)}
      />

      {(categoryId || gameId || minPrice || maxPrice || inStock) ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setMinDraft("");
            setMaxDraft("");
            onCategoryChange(null);
            onGameChange(null);
            onPriceChange({ minPrice: null, maxPrice: null });
            onInStockChange(false);
          }}
        >
          Clear all filters
        </Button>
      ) : null}
    </Card>
  );
}
