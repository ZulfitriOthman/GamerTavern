import { useState } from "react";
import { Link } from "react-router-dom";
import Card from "../ui/Card.jsx";
import Button from "../ui/Button.jsx";
import { TextField, TextareaField, SelectField } from "../ui/Field.jsx";
import FieldHelp from "../ui/FieldHelp.jsx";
import ProductImageEditor from "./ProductImageEditor.jsx";
import { useProductCategories } from "../../features/merchant/useProductCategories.js";
import { useTcgGames } from "../../features/tcg/useTcgGames.js";
import { useProductTypes } from "../../features/shop/useProductTypes.js";

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft — not visible to customers" },
  { value: "active", label: "Active — visible in the storefront" },
  { value: "out_of_stock", label: "Out of stock" },
  { value: "archived", label: "Archived" },
];

// Matches Backend/controllers/product.controller.js's own gating exactly —
// by category SLUG (stable), never by display name. "Trading Card Games"
// requires a TCG Game (a card belongs to exactly one game); "TCG
// Accessories" allows one optionally (a deck box can be game-branded or
// generic); every other category never shows or stores one.
const TCG_GAME_REQUIRED_SLUG = "trading-card-games";
const TCG_GAME_OPTIONAL_SLUG = "tcg-accessories";

// PRODUCT_IMAGES rows come back from the backend as { image_url, is_primary,
// sort_order } (snake_case, matching the DB columns — see
// Backend/controllers/product.controller.js's fetchImagesByProductIds). The
// image editor's own contract is { url, isPrimary } (camelCase — matching
// what ProductImageEditor.jsx builds for a freshly-uploaded image). Without
// this mapping, every pre-existing image on an edit page had img.url
// undefined, which resolveProductImageUrl() turns into a broken <img src>,
// and would have re-saved as an empty image_url on the next submit.
function toEditorImages(images) {
  return (images || []).map((img) => ({
    url: img.url ?? img.image_url,
    isPrimary: img.isPrimary ?? Boolean(img.is_primary),
  }));
}

function toFormState(product) {
  return {
    name: product?.name || "",
    code: product?.code || "",
    categoryId: product?.category_id ? String(product.category_id) : "",
    tcgGameId: product?.tcg_game_id ? String(product.tcg_game_id) : "",
    productTypeId: product?.product_type_id ? String(product.product_type_id) : "",
    brand: product?.brand || "",
    shortDescription: product?.short_description || "",
    description: product?.description || "",
    conditionLabel: product?.condition_label || "",
    price: product?.price != null ? String(product.price) : "",
    stockQuantity: product?.stock_quantity != null ? String(product.stock_quantity) : "0",
    lowStockThreshold: product?.low_stock_threshold != null ? String(product.low_stock_threshold) : "",
    status: product?.status || "active",
    featured: Boolean(product?.featured),
    tags: product?.tags || "",
  };
}

// Shared by "new" and "edit" — the only difference is whether `product` (the
// existing row) is passed and whether stock_quantity is editable (see the note
// below: it never is here, by design).
export default function ProductForm({ product = null, onSubmit, submitting, submitLabel }) {
  const isEdit = Boolean(product);
  const { categories, status: categoriesStatus } = useProductCategories();
  const { games: tcgGames, status: tcgGamesStatus } = useTcgGames();
  const { types: allProductTypes, status: productTypesStatus } = useProductTypes();
  const [form, setForm] = useState(() => toFormState(product));
  const [images, setImages] = useState(() => toEditorImages(product?.images));
  const [error, setError] = useState(null);

  const selectedCategory = categories.find((c) => String(c.id) === form.categoryId);
  const tcgRequirement =
    selectedCategory?.slug === TCG_GAME_REQUIRED_SLUG ? "required" : selectedCategory?.slug === TCG_GAME_OPTIONAL_SLUG ? "optional" : "none";
  const showTcgGameField = tcgRequirement !== "none";

  // Data-driven, not a hardcoded category slug (mirrors
  // resolveProductTypeRequirement() in product.controller.js): the
  // selected category requires a Product Type iff PRODUCT_TYPES has any
  // active rows for it — today that's only Trading Card Games, but a
  // future category (Gunpla grades, ...) starts requiring one the moment
  // rows exist, with no code change here.
  const productTypeOptions = selectedCategory ? allProductTypes.filter((t) => t.category_id === selectedCategory.id) : [];
  const showProductTypeField = productTypeOptions.length > 0;

  function updateField(field) {
    return (event) => {
      const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
      setForm((prev) => ({ ...prev, [field]: value }));
    };
  }

  // Switching away from a TCG-related category must not silently leave a
  // stale game selection behind, hidden but still set — clear it the moment
  // the category no longer supports one. (The backend enforces this too,
  // regardless of what the form sends — see product.controller.js.)
  function updateCategory(event) {
    const categoryId = event.target.value;
    const nextCategory = categories.find((c) => String(c.id) === categoryId);
    const nextRequirement =
      nextCategory?.slug === TCG_GAME_REQUIRED_SLUG ? "required" : nextCategory?.slug === TCG_GAME_OPTIONAL_SLUG ? "optional" : "none";
    const nextHasProductTypes = nextCategory ? allProductTypes.some((t) => t.category_id === nextCategory.id) : false;
    setForm((prev) => ({
      ...prev,
      categoryId,
      tcgGameId: nextRequirement === "none" ? "" : prev.tcgGameId,
      productTypeId: nextHasProductTypes ? prev.productTypeId : "",
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    if (!form.name.trim() || !form.code.trim()) {
      setError("Product name and SKU are required.");
      return;
    }
    if (!form.categoryId) {
      setError("Choose a category.");
      return;
    }
    if (tcgRequirement === "required" && !form.tcgGameId) {
      setError("Choose a TCG Game.");
      return;
    }
    if (showProductTypeField && !form.productTypeId) {
      setError("Choose a Product Type.");
      return;
    }
    const price = Number(form.price);
    if (!Number.isFinite(price) || price < 0) {
      setError("Enter a valid, non-negative price.");
      return;
    }

    const fields = {
      name: form.name.trim(),
      code: form.code.trim(),
      categoryId: Number(form.categoryId),
      tcgGameId: showTcgGameField && form.tcgGameId ? Number(form.tcgGameId) : null,
      productTypeId: showProductTypeField && form.productTypeId ? Number(form.productTypeId) : null,
      brand: form.brand.trim() || undefined,
      shortDescription: form.shortDescription.trim() || undefined,
      description: form.description.trim() || undefined,
      conditionLabel: form.conditionLabel.trim() || undefined,
      price,
      lowStockThreshold: form.lowStockThreshold ? Number(form.lowStockThreshold) : null,
      status: form.status,
      featured: form.featured,
      tags: form.tags.trim() || undefined,
      images,
    };

    if (!isEdit) {
      fields.stockQuantity = Number(form.stockQuantity) || 0;
    }

    try {
      await onSubmit(fields);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      <Card variant="form">
        <h2 className="font-display text-base font-semibold text-amber-50">Basics</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <TextField id="pf-name" label="Product name" value={form.name} onChange={updateField("name")} required />
          <TextField
            id="pf-code"
            label="SKU"
            labelExtra={
              <FieldHelp label="What is an SKU?">
                SKU stands for Stock Keeping Unit. It's a unique code used to identify and manage this product in your
                inventory.
                <br />
                <br />
                Example: TCG-SLEEVE-001
                {tcgRequirement === "required" ? (
                  <>
                    <br />
                    <br />
                    Tip: for Trading Card Games products, you may include the game and product type to make stock
                    easier to identify — e.g. Vanguard Booster Box → VG-BB-001, Pokémon Booster Box → PKM-BB-001,
                    Magic Single Card → MTG-SC-001. This is only a naming suggestion, not a required format.
                  </>
                ) : null}
              </FieldHelp>
            }
            hint="Unique product code used for inventory tracking."
            value={form.code}
            onChange={updateField("code")}
            required
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <SelectField
            id="pf-category"
            label="Category"
            value={form.categoryId}
            onChange={updateCategory}
            hint={categoriesStatus === "error" ? "Couldn't load categories." : undefined}
            required
          >
            <option value="">Select a category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectField>
          {showTcgGameField ? (
            <SelectField
              id="pf-tcg-game"
              label="TCG Game"
              value={form.tcgGameId}
              onChange={updateField("tcgGameId")}
              hint={tcgGamesStatus === "error" ? "Couldn't load TCG games." : tcgRequirement === "optional" ? "Optional" : undefined}
              required={tcgRequirement === "required"}
            >
              <option value="">{tcgRequirement === "required" ? "Select a game" : "No specific game"}</option>
              {tcgGames.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </SelectField>
          ) : (
            <TextField id="pf-brand" label="Brand" hint="Optional" value={form.brand} onChange={updateField("brand")} />
          )}
        </div>

        {showTcgGameField ? (
          <div className={["mt-4 grid gap-4", showProductTypeField ? "sm:grid-cols-3" : "sm:grid-cols-2"].join(" ")}>
            {showProductTypeField ? (
              <SelectField
                id="pf-product-type"
                label="TCG Product Type"
                value={form.productTypeId}
                onChange={updateField("productTypeId")}
                hint={productTypesStatus === "error" ? "Couldn't load product types." : "What the customer is buying — not your SKU."}
                required
              >
                <option value="">Select a type</option>
                {productTypeOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </SelectField>
            ) : null}
            <TextField id="pf-brand" label="Brand" hint="Optional" value={form.brand} onChange={updateField("brand")} />
            <TextField id="pf-condition" label="Condition" hint="Optional, e.g. New, Used" value={form.conditionLabel} onChange={updateField("conditionLabel")} />
          </div>
        ) : null}

        <div className="mt-4">
          <TextField id="pf-short-desc" label="Short description" hint="Optional, shown in listings" value={form.shortDescription} onChange={updateField("shortDescription")} />
        </div>
        <div className="mt-4">
          <TextareaField id="pf-description" label="Description" hint="Optional" rows={5} value={form.description} onChange={updateField("description")} />
        </div>

        {showTcgGameField ? (
          <div className="mt-4">
            <TextField id="pf-tags" label="Tags" hint="Optional, comma-separated — e.g. Maelstrom, V-Series, Aqua Force" value={form.tags} onChange={updateField("tags")} />
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <TextField id="pf-condition" label="Condition" hint="Optional, e.g. New, Used" value={form.conditionLabel} onChange={updateField("conditionLabel")} />
            <TextField id="pf-tags" label="Tags" hint="Optional, comma-separated" value={form.tags} onChange={updateField("tags")} />
          </div>
        )}
      </Card>

      <Card variant="form">
        <h2 className="font-display text-base font-semibold text-amber-50">Pricing & stock</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <TextField id="pf-price" label="Price (BND)" type="number" min="0" step="0.01" value={form.price} onChange={updateField("price")} required />
          {isEdit ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm text-amber-50/70">Current stock</span>
              <p className="rounded-lg border border-white/10 bg-ink-900/50 px-3.5 py-2.5 text-sm text-amber-50/60">
                {product.stock_quantity} — adjust from{" "}
                <Link to="/merchant/inventory" className="text-brand-400 hover:text-brand-300">
                  Inventory
                </Link>
              </p>
            </div>
          ) : (
            <TextField id="pf-stock" label="Initial stock" type="number" min="0" step="1" value={form.stockQuantity} onChange={updateField("stockQuantity")} required />
          )}
          <TextField id="pf-low-stock" label="Low stock threshold" hint="Optional" type="number" min="0" step="1" value={form.lowStockThreshold} onChange={updateField("lowStockThreshold")} />
        </div>
      </Card>

      <Card variant="form">
        <h2 className="font-display text-base font-semibold text-amber-50">Visibility</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <SelectField id="pf-status" label="Status" value={form.status} onChange={updateField("status")}>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </SelectField>
          <label className="flex items-center gap-2 self-end pb-2.5 text-sm text-amber-50/70">
            <input type="checkbox" checked={form.featured} onChange={updateField("featured")} className="h-4 w-4 rounded border-white/20 bg-ink-900 text-brand-500 focus-ring" />
            Feature this product
          </label>
        </div>
      </Card>

      <Card variant="form">
        <h2 className="font-display text-base font-semibold text-amber-50">Images</h2>
        <p className="mt-1 text-xs text-amber-50/45">The first image (or the one marked Primary) is shown in listings.</p>
        <div className="mt-4">
          <ProductImageEditor images={images} onChange={setImages} />
        </div>
      </Card>

      {error ? (
        <p role="alert" className="text-sm text-danger-400">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" isLoading={submitting}>
          {submitLabel}
        </Button>
        <Button variant="secondary" to="/merchant/products">
          Cancel
        </Button>
      </div>
    </form>
  );
}
