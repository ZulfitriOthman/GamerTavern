import { useState } from "react";
import { Link } from "react-router-dom";
import Card from "../ui/Card.jsx";
import Button from "../ui/Button.jsx";
import { TextField, TextareaField, SelectField } from "../ui/Field.jsx";
import ProductImageEditor from "./ProductImageEditor.jsx";
import { useProductCategories } from "../../features/merchant/useProductCategories.js";

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft — not visible to customers" },
  { value: "active", label: "Active — visible in the storefront" },
  { value: "out_of_stock", label: "Out of stock" },
  { value: "archived", label: "Archived" },
];

function toFormState(product) {
  return {
    name: product?.name || "",
    code: product?.code || "",
    categoryId: product?.category_id ? String(product.category_id) : "",
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
  const [form, setForm] = useState(() => toFormState(product));
  const [images, setImages] = useState(product?.images || []);
  const [error, setError] = useState(null);

  function updateField(field) {
    return (event) => {
      const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
      setForm((prev) => ({ ...prev, [field]: value }));
    };
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
    const price = Number(form.price);
    if (!Number.isFinite(price) || price < 0) {
      setError("Enter a valid, non-negative price.");
      return;
    }

    const fields = {
      name: form.name.trim(),
      code: form.code.trim(),
      categoryId: Number(form.categoryId),
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
          <TextField id="pf-code" label="SKU" value={form.code} onChange={updateField("code")} required />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <SelectField
            id="pf-category"
            label="Category"
            value={form.categoryId}
            onChange={updateField("categoryId")}
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
          <TextField id="pf-brand" label="Brand" hint="Optional" value={form.brand} onChange={updateField("brand")} />
        </div>

        <div className="mt-4">
          <TextField id="pf-short-desc" label="Short description" hint="Optional, shown in listings" value={form.shortDescription} onChange={updateField("shortDescription")} />
        </div>
        <div className="mt-4">
          <TextareaField id="pf-description" label="Description" hint="Optional" rows={5} value={form.description} onChange={updateField("description")} />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <TextField id="pf-condition" label="Condition" hint="Optional, e.g. New, Used" value={form.conditionLabel} onChange={updateField("conditionLabel")} />
          <TextField id="pf-tags" label="Tags" hint="Optional, comma-separated" value={form.tags} onChange={updateField("tags")} />
        </div>
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
