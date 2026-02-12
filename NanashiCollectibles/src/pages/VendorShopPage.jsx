// src/pages/VendorShopPage.jsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { TCG_LIST } from "../data/products";
import { getSocket } from "../socket/socketClient";

const ROLES = {
  USER: "USER",
  VENDOR: "VENDOR",
  ADMIN: "ADMIN",
};

const PLACEHOLDER = "/placeholder.png";

// ✅ IMPORTANT: define helpers BEFORE any function uses them (no TDZ bugs)
const toStr = (v) => (v == null ? "" : String(v)).trim();
const toInt = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

function normalizeRole(role) {
  const r = String(role || ROLES.USER).toUpperCase();
  return Object.values(ROLES).includes(r) ? r : ROLES.USER;
}

// Buffer-safe (if DB returns Buffer for BLOB/TEXT fields)
function asText(v) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  // mysql2 may return Buffer for BLOB
  if (v?.type === "Buffer" && Array.isArray(v?.data)) {
    return new TextDecoder().decode(new Uint8Array(v.data));
  }
  if (v instanceof ArrayBuffer) return new TextDecoder().decode(new Uint8Array(v));
  if (v instanceof Uint8Array) return new TextDecoder().decode(v);
  if (Buffer.isBuffer?.(v)) return v.toString("utf8");
  return String(v);
}

// ✅ Resolve image URLs correctly for BOTH dev/prod
// - absolute http(s) stays as-is
// - backend static "/public/..." should be prefixed with API base (so Vite dev server doesn't try to serve it)
// - "/placeholder.png" or other local assets remain local
const API_BASE =
  (import.meta?.env?.VITE_API_BASE && String(import.meta.env.VITE_API_BASE)) ||
  "http://localhost:3001";

function resolveImageSrc(url) {
  const s = toStr(url);
  if (!s) return PLACEHOLDER;

  // absolute http(s)
  if (/^https?:\/\//i.test(s)) return s;

  // backend static served at /public/...
  if (s.startsWith("/public/")) return `${API_BASE}${s}`;

  // local public assets like /placeholder.png
  if (s.startsWith("/")) return s;

  return PLACEHOLDER;
}

export default function VendorShopPage({
  cart,
  addToCart,
  removeFromCart,
  updateQuantity,
  cartTotalItems,
  cartTotalPrice,
}) {
  const { tcgId } = useParams();
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState(null);

  // DB products loaded from socket
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [serverError, setServerError] = useState("");

  // Add product UI
  const [showAdd, setShowAdd] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: "",
    code: "",
    conditional: "NEW",
    price: 0,
    stock_quantity: 0,
    image_url: "",
    description: "",
    tcg: "mtg", // UI only; your DB schema currently has no tcg column
  });

  // ✅ Manage Inventory UI state (per product)
  const [stockInput, setStockInput] = useState({}); // { [productId]: string }
  const getQty = (productId) => toInt(stockInput[productId], 0);

  // ----------------------------
  // Socket helpers
  // ----------------------------
  const emitAsync = (event, payload) =>
    new Promise((resolve) => {
      const s = getSocket();
      if (!s?.connected) {
        return resolve({ success: false, message: "Socket not connected." });
      }
      s.emit(event, payload, (res) => resolve(res));
    });

  // ✅ restock / reduce (delta-based)
  const applyDeltaStock = async (productId, delta) => {
    if (!currentUser?.id) return;

    if (!Number.isFinite(delta) || delta === 0) {
      setServerError("Quantity must be more than 0.");
      return;
    }

    setServerError("");
    const res = await emitAsync("inventory:adjust", {
      currentUser: { id: currentUser.id, role: currentUser.role },
      product_id: productId,
      delta,
    });

    if (!res?.success) {
      setServerError(res?.message || "Failed to update inventory.");
      return;
    }

    // clear input for that product after success
    setStockInput((m) => ({ ...m, [productId]: "" }));
  };

  // ✅ set stock directly (convert to delta)
  const setExactStock = async (productId, newQty, currentStock) => {
    const next = Math.max(0, toInt(newQty, 0));
    const curr = Math.max(0, toInt(currentStock, 0));
    const delta = next - curr;

    if (delta === 0) {
      setServerError("Stock is already that value.");
      return;
    }

    return applyDeltaStock(productId, delta);
  };

  // ✅ Guard: must be logged in AND vendor/admin
  useEffect(() => {
    const raw = localStorage.getItem("tavern_current_user");
    const user = raw ? JSON.parse(raw) : null;

    if (!user?.id) {
      navigate("/login");
      return;
    }

    user.role = normalizeRole(user?.role);

    if (!(user.role === ROLES.VENDOR || user.role === ROLES.ADMIN)) {
      navigate("/user/shop");
      return;
    }

    setCurrentUser(user);
  }, [navigate]);

  // Selected TCG – driven by URL if present
  const [selectedTcg, setSelectedTcg] = useState(() => {
    if (tcgId && TCG_LIST.some((t) => t.id === tcgId)) return tcgId;
    return "mtg";
  });

  useEffect(() => {
    if (!tcgId) return;
    if (TCG_LIST.some((t) => t.id === tcgId)) setSelectedTcg(tcgId);
  }, [tcgId]);

  const activeTcg = useMemo(
    () => TCG_LIST.find((t) => t.id === selectedTcg),
    [selectedTcg],
  );

  const handleSelectTcg = (id) => {
    setSelectedTcg(id);
    navigate(`/vendor/tcg/${id}`);
  };

  const loadProducts = async () => {
    if (!currentUser?.id) return;
    setLoadingProducts(true);
    setServerError("");

    const res = await emitAsync("product:list", {
      currentUser: { id: currentUser.id, role: currentUser.role },
      // optional future filters:
      // vendorId: currentUser.id,
    });

    setLoadingProducts(false);

    if (!res?.success) {
      setServerError(res?.message || "Failed to load products.");
      return;
    }

    // Map DB rows into UI-friendly objects
    const rows = Array.isArray(res.data) ? res.data : [];
    const mapped = rows.map((r) => ({
      id: r.id,
      vendor_id: r.vendor_id,
      name: r.name,
      code: r.code,
      conditional: r.conditional,
      price: toInt(r.price),
      stock: toInt(r.stock_quantity),
      // ✅ IMPORTANT: resolve "/public/..." using API_BASE so it works in Vite dev
      image: resolveImageSrc(asText(r.image_url)),
      description: asText(r.description),
    }));

    setProducts(mapped);
  };

  // Listen for realtime updates + initial load
  useEffect(() => {
    if (!currentUser?.id) return;

    const s = getSocket();
    if (!s) return;

    loadProducts();

    const onCreated = () => loadProducts();
    const onUpdated = () => loadProducts();
    const onDeleted = () => loadProducts();
    const onInvUpdated = () => loadProducts();

    s.on("product:created", onCreated);
    s.on("product:updated", onUpdated);
    s.on("product:deleted", onDeleted);
    s.on("inventory:updated", onInvUpdated);

    return () => {
      s.off("product:created", onCreated);
      s.off("product:updated", onUpdated);
      s.off("product:deleted", onDeleted);
      s.off("inventory:updated", onInvUpdated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  const filteredProducts = useMemo(() => products, [products]);

  // ----------------------------
  // Vendor actions (DB via socket)
  // ----------------------------
  const submitAddProduct = async (e) => {
    e.preventDefault();
    if (!currentUser?.id) return;

    const payload = {
      currentUser: { id: currentUser.id, role: currentUser.role },
      name: toStr(newProduct.name),
      code: toStr(newProduct.code),
      conditional: toStr(newProduct.conditional),
      price: toInt(newProduct.price),
      stock_quantity: toInt(newProduct.stock_quantity),
      image_url: toStr(newProduct.image_url),
      description: toStr(newProduct.description),
    };

    if (!payload.name || !payload.code) {
      setServerError("Product name and code are required.");
      return;
    }

    setServerError("");
    const res = await emitAsync("product:create", payload);
    if (!res?.success) {
      setServerError(res?.message || "Failed to create product.");
      return;
    }

    setShowAdd(false);
    setNewProduct({
      name: "",
      code: "",
      conditional: "NEW",
      price: 0,
      stock_quantity: 0,
      image_url: "",
      description: "",
      tcg: "mtg",
    });

    loadProducts();
  };

  const adjustStock = async (productId, delta) => {
    if (!currentUser?.id) return;

    const res = await emitAsync("inventory:adjust", {
      currentUser: { id: currentUser.id, role: currentUser.role },
      product_id: productId,
      delta,
    });

    if (!res?.success) {
      setServerError(res?.message || "Failed to adjust inventory.");
      return;
    }
  };

  const deleteProduct = async (productId) => {
    if (!currentUser?.id) return;

    const ok = window.confirm("Delete this product? This cannot be undone.");
    if (!ok) return;

    const res = await emitAsync("product:delete", {
      currentUser: { id: currentUser.id, role: currentUser.role },
      id: productId,
    });

    if (!res?.success) {
      setServerError(res?.message || "Failed to delete product.");
      return;
    }
  };

  if (!currentUser) return null;

  return (
    <div className="relative flex flex-col gap-6 md:flex-row">
      <div className="pointer-events-none absolute -left-32 top-10 h-64 w-64 rounded-full bg-purple-900/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 bottom-0 h-72 w-72 rounded-full bg-amber-800/25 blur-3xl" />

      <section className="relative z-10 flex-1 space-y-6">
        {/* Role banner */}
        <div className="overflow-hidden rounded-2xl border border-emerald-900/40 bg-gradient-to-br from-slate-950 via-emerald-950/20 to-slate-950 p-4 shadow-lg shadow-emerald-900/20">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-serif text-xs text-emerald-100/70">
                Logged in as{" "}
                <span className="font-semibold text-emerald-200">
                  {currentUser?.name}
                </span>
              </p>
              <p className="font-serif text-[11px] uppercase tracking-[0.25em] text-emerald-400">
                ROLE: {currentUser?.role}
              </p>
            </div>

            <span className="rounded-full border border-emerald-600/40 bg-emerald-950/30 px-3 py-1 font-serif text-[10px] uppercase tracking-wide text-emerald-200">
              Vendor Mode: Buy + Sell
            </span>
          </div>
        </div>

        {/* Errors */}
        {serverError ? (
          <div className="rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            {serverError}
          </div>
        ) : null}

        {/* Vendor console */}
        <div className="rounded-2xl border border-emerald-900/40 bg-gradient-to-br from-slate-950 to-emerald-950/20 p-5 shadow-lg shadow-emerald-900/20">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-serif text-base font-bold text-emerald-100">
                Vendor Console
              </h3>
              <p className="mt-1 font-serif text-[11px] italic text-emerald-100/70">
                Create listings, manage stock, and sell items.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAdd(true)}
                className="rounded-xl border border-emerald-500/50 bg-gradient-to-r from-emerald-950/40 to-slate-950 px-4 py-2 font-serif text-xs font-semibold text-emerald-100 hover:border-emerald-400"
              >
                + Add Product
              </button>

              <button
                type="button"
                onClick={loadProducts}
                className="rounded-xl border border-emerald-500/30 bg-slate-950/40 px-4 py-2 font-serif text-xs text-emerald-100/80 hover:border-emerald-400"
              >
                Refresh
              </button>
            </div>
          </div>

          {/* Add Product modal/panel */}
          {showAdd ? (
            <form
              onSubmit={submitAddProduct}
              className="mt-4 rounded-2xl border border-emerald-700/30 bg-slate-950/40 p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="font-serif text-sm font-semibold text-emerald-100">
                  New Product
                </p>
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="font-serif text-xs text-emerald-200/70 hover:text-emerald-200"
                >
                  Close ✕
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-serif text-xs text-emerald-100/80">
                    Name
                  </label>
                  <input
                    value={newProduct.name}
                    onChange={(e) =>
                      setNewProduct((p) => ({ ...p, name: e.target.value }))
                    }
                    className="w-full rounded-lg border border-emerald-900/40 bg-slate-950 px-3 py-2 font-serif text-sm text-emerald-50"
                    placeholder="e.g. MTG Booster Pack"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-serif text-xs text-emerald-100/80">
                    Code
                  </label>
                  <input
                    value={newProduct.code}
                    onChange={(e) =>
                      setNewProduct((p) => ({ ...p, code: e.target.value }))
                    }
                    className="w-full rounded-lg border border-emerald-900/40 bg-slate-950 px-3 py-2 font-serif text-sm text-emerald-50"
                    placeholder="e.g. MTG-BST-001"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-serif text-xs text-emerald-100/80">
                    Condition
                  </label>
                  <select
                    value={newProduct.conditional}
                    onChange={(e) =>
                      setNewProduct((p) => ({
                        ...p,
                        conditional: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-emerald-900/40 bg-slate-950 px-3 py-2 font-serif text-sm text-emerald-50"
                  >
                    <option value="NEW">NEW</option>
                    <option value="USED">USED</option>
                    <option value="SEALED">SEALED</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block font-serif text-xs text-emerald-100/80">
                      Price (BND)
                    </label>
                    <input
                      type="number"
                      value={newProduct.price}
                      onChange={(e) =>
                        setNewProduct((p) => ({ ...p, price: e.target.value }))
                      }
                      className="w-full rounded-lg border border-emerald-900/40 bg-slate-950 px-3 py-2 font-serif text-sm text-emerald-50"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block font-serif text-xs text-emerald-100/80">
                      Stock Qty
                    </label>
                    <input
                      type="number"
                      value={newProduct.stock_quantity}
                      onChange={(e) =>
                        setNewProduct((p) => ({
                          ...p,
                          stock_quantity: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-emerald-900/40 bg-slate-950 px-3 py-2 font-serif text-sm text-emerald-50"
                    />
                  </div>
                </div>

                {/* ✅ Product Image Upload */}
                <div className="sm:col-span-2">
                  <label className="mb-1 block font-serif text-xs text-emerald-100/80">
                    Product Image
                  </label>

                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;

                      try {
                        // basic validation
                        if (!file.type.startsWith("image/")) {
                          throw new Error("Please select an image file.");
                        }
                        if (file.size > 5 * 1024 * 1024) {
                          throw new Error("Max image size is 5MB.");
                        }

                        const fd = new FormData();
                        fd.append("image", file);

                        const resp = await fetch(
                          `${API_BASE}/api/upload/product-image`,
                          {
                            method: "POST",
                            body: fd,
                            credentials: "include",
                          },
                        );

                        const json = await resp.json();
                        if (!json.ok) {
                          throw new Error(json.message || "Upload failed");
                        }

                        setNewProduct((p) => ({ ...p, image_url: json.url }));

                        // allow selecting same file again later
                        e.target.value = "";
                      } catch (err) {
                        setServerError(err?.message || "Failed to upload image.");
                      }
                    }}
                    className="w-full rounded-lg border border-emerald-900/40 bg-slate-950 px-3 py-2 font-serif text-sm text-emerald-50"
                  />

                  {newProduct.image_url ? (
                    <div className="mt-2 flex items-center gap-3">
                      <img
                        src={resolveImageSrc(newProduct.image_url)}
                        alt="Preview"
                        className="h-14 w-14 rounded-lg object-cover border border-emerald-900/40"
                        onError={(e) => (e.currentTarget.src = PLACEHOLDER)}
                      />
                      <span className="font-serif text-[11px] text-emerald-200/70">
                        Saved: {newProduct.image_url}
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block font-serif text-xs text-emerald-100/80">
                    Description
                  </label>
                  <textarea
                    value={newProduct.description}
                    onChange={(e) =>
                      setNewProduct((p) => ({
                        ...p,
                        description: e.target.value,
                      }))
                    }
                    className="min-h-[90px] w-full rounded-lg border border-emerald-900/40 bg-slate-950 px-3 py-2 font-serif text-sm text-emerald-50"
                    placeholder="Short description..."
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="rounded-xl border border-emerald-900/40 bg-slate-950/50 px-4 py-2 font-serif text-xs text-emerald-100/80 hover:border-emerald-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl border border-emerald-500/50 bg-gradient-to-r from-emerald-950/40 to-slate-950 px-4 py-2 font-serif text-xs font-semibold text-emerald-100 hover:border-emerald-400"
                >
                  Create Product
                </button>
              </div>
            </form>
          ) : null}
        </div>

        {/* TCG selector (routing only) */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {TCG_LIST.map((tcg) => {
            const isActive = tcg.id === selectedTcg;
            const initial = tcg.name?.[0] ?? "?";
            return (
              <button
                key={tcg.id}
                onClick={() => handleSelectTcg(tcg.id)}
                className={[
                  "group relative flex h-28 flex-col justify-between overflow-hidden rounded-xl border p-4 text-left transition-all duration-200",
                  isActive
                    ? "border-emerald-400/70 bg-gradient-to-br from-emerald-950/40 via-slate-950 to-slate-950 shadow-xl shadow-emerald-900/25 ring-1 ring-emerald-300/40"
                    : "border-emerald-900/30 bg-gradient-to-br from-slate-950 to-emerald-950/10 hover:border-emerald-400/60",
                ].join(" ")}
              >
                <div className="relative flex items-center justify-between gap-3">
                  <span className="font-serif text-[10px] uppercase tracking-[0.18em] text-emerald-300">
                    Trading Card Game
                  </span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500/40 bg-slate-950/80 text-xs font-bold text-emerald-200">
                    {initial}
                  </div>
                </div>

                <span className="relative mt-1 font-serif text-sm font-semibold text-emerald-50">
                  {tcg.name}
                </span>

                <div
                  className={[
                    "pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r opacity-70",
                    tcg.color,
                  ].join(" ")}
                />
              </button>
            );
          })}
        </div>

        {/* Products */}
        <div className="mt-2">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="font-serif text-xl font-bold text-amber-100">
                {activeTcg?.name} Products
              </h3>
              <p className="font-serif text-[11px] italic text-amber-200/70">
                Vendor view: DB products + stock controls enabled.
              </p>
            </div>

            <p className="font-serif text-xs italic text-amber-500">
              {loadingProducts ? "Loading..." : `${filteredProducts.length} item(s)`}
            </p>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="rounded-xl border border-amber-900/40 bg-gradient-to-br from-slate-950 to-purple-950/40 p-6 text-sm italic text-amber-100/70">
              No products found in DB yet.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredProducts.map((p) => (
                <article
                  key={p.id}
                  className="group relative flex flex-col overflow-hidden rounded-xl border border-amber-900/40 bg-gradient-to-br from-slate-950 to-purple-950/40 shadow-lg shadow-purple-900/30"
                >
                  <div className="relative h-40 w-full overflow-hidden">
                    <img
                      src={resolveImageSrc(p.image)}
                      alt={p.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                      onError={(e) => {
                        e.currentTarget.src = PLACEHOLDER;
                      }}
                    />
                    <div className="absolute bottom-2 right-2 rounded-full border border-emerald-500/60 bg-slate-950/80 px-3 py-1 font-serif text-[11px] font-semibold text-emerald-300">
                      BND {toInt(p.price).toFixed(2)}
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <h4 className="line-clamp-2 font-serif text-sm font-semibold text-amber-50">
                      {p.name}
                    </h4>

                    <div className="flex items-center justify-between text-[11px] text-amber-100/70">
                      <span className="italic">
                        Stock:{" "}
                        <span className="font-semibold text-amber-300">
                          {toInt(p.stock)}
                        </span>
                      </span>
                      <span className="rounded-full border border-emerald-700/40 bg-emerald-950/30 px-2 py-0.5 font-serif text-[10px] uppercase tracking-wide text-emerald-200">
                        CODE: {p.code || "-"}
                      </span>
                    </div>

                    {/* BUY */}
                    <button
                      onClick={() =>
                        addToCart({
                          id: p.id,
                          name: p.name,
                          price: toInt(p.price),
                          image: resolveImageSrc(p.image),
                          stock: toInt(p.stock),
                        })
                      }
                      disabled={toInt(p.stock) === 0}
                      className="mt-2 inline-flex items-center justify-center rounded-lg border border-amber-500/60 bg-gradient-to-r from-amber-950/60 to-purple-950/60 px-3 py-2 font-serif text-[11px] font-semibold uppercase tracking-wide text-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {toInt(p.stock) === 0 ? "Out of Stock" : "Add to Cart"}
                    </button>

                    {/* ✅ Manage Inventory */}
                    <div className="mt-3 rounded-xl border border-emerald-900/40 bg-slate-950/40 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="font-serif text-[11px] font-semibold text-emerald-200">
                          Manage Inventory
                        </span>
                        <span className="font-serif text-[10px] text-emerald-200/60">
                          Current: {toInt(p.stock)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          value={stockInput[p.id] ?? ""}
                          onChange={(e) =>
                            setStockInput((m) => ({
                              ...m,
                              [p.id]: e.target.value,
                            }))
                          }
                          className="w-24 rounded-lg border border-emerald-900/40 bg-slate-950 px-3 py-2 font-serif text-[11px] text-emerald-50"
                          placeholder="Qty"
                        />

                        <button
                          type="button"
                          onClick={() => applyDeltaStock(p.id, +getQty(p.id))}
                          className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-3 py-2 font-serif text-[11px] font-semibold text-emerald-100 hover:border-emerald-400"
                          title="Add qty to stock"
                        >
                          Restock
                        </button>

                        <button
                          type="button"
                          onClick={() => applyDeltaStock(p.id, -getQty(p.id))}
                          disabled={toInt(p.stock) === 0}
                          className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-3 py-2 font-serif text-[11px] font-semibold text-emerald-100 hover:border-emerald-400 disabled:opacity-50"
                          title="Subtract qty from stock"
                        >
                          Reduce
                        </button>

                        <button
                          type="button"
                          onClick={() => setExactStock(p.id, getQty(p.id), p.stock)}
                          className="rounded-lg border border-amber-500/40 bg-amber-950/30 px-3 py-2 font-serif text-[11px] font-semibold text-amber-100 hover:border-amber-400"
                          title="Set stock to this exact qty"
                        >
                          Set
                        </button>
                      </div>

                      <div className="mt-2 grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => adjustStock(p.id, +1)}
                          className="rounded-lg border border-emerald-500/40 bg-emerald-950/20 px-3 py-2 font-serif text-[11px] font-semibold text-emerald-100 hover:border-emerald-400"
                          title="Increase stock by 1"
                        >
                          +1
                        </button>

                        <button
                          type="button"
                          onClick={() => adjustStock(p.id, -1)}
                          disabled={toInt(p.stock) === 0}
                          className="rounded-lg border border-emerald-500/40 bg-emerald-950/20 px-3 py-2 font-serif text-[11px] font-semibold text-emerald-100 hover:border-emerald-400 disabled:opacity-50"
                          title="Decrease stock by 1"
                        >
                          -1
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteProduct(p.id)}
                          className="rounded-lg border border-rose-500/40 bg-rose-950/20 px-3 py-2 font-serif text-[11px] font-semibold text-rose-200 hover:border-rose-400"
                          title="Delete product"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        alert(
                          `Sell / listing flow for: ${p.name} (next step: vendor listing UI)`,
                        )
                      }
                      className="mt-2 inline-flex items-center justify-center rounded-lg border border-emerald-500/50 bg-gradient-to-r from-emerald-950/40 to-slate-950 px-3 py-2 font-serif text-[11px] font-semibold uppercase tracking-wide text-emerald-100 hover:border-emerald-400"
                    >
                      Sell / List Item
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* RIGHT cart */}
      <aside className="relative z-10 mt-6 w-full max-w-sm md:mt-0 md:w-80">
        <div className="sticky top-20 overflow-hidden rounded-2xl border border-amber-900/50 bg-gradient-to-br from-slate-950 via-purple-950/45 to-slate-950 p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="font-serif text-base font-bold text-amber-50">
                Arcane Cart
              </h3>
              <p className="font-serif text-[11px] italic text-amber-200/70">
                Review relics before sealing the deal.
              </p>
            </div>
            <span className="rounded-full border border-amber-700/50 bg-amber-950/50 px-3 py-1 font-serif text-[10px] uppercase tracking-wide text-amber-200">
              {cartTotalItems} item{cartTotalItems !== 1 ? "s" : ""}
            </span>
          </div>

          {cart.length === 0 ? (
            <p className="font-serif text-xs italic text-amber-100/65">
              Your cart is empty.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-2 rounded-xl border border-amber-900/40 bg-gradient-to-br from-slate-950 to-purple-950/40 p-3"
                  >
                    <div className="flex flex-1 flex-col">
                      <span className="font-serif text-xs font-semibold text-amber-50">
                        {item.name}
                      </span>
                      <span className="font-serif text-[11px] italic text-amber-100/65">
                        BND {item.price.toFixed(2)} each
                      </span>
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) =>
                            updateQuantity(item.id, Number(e.target.value))
                          }
                          className="w-14 rounded-md border border-amber-900/50 bg-slate-950 px-2 py-1 font-serif text-[11px] text-amber-50"
                        />
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="font-serif text-[11px] text-rose-400 hover:text-rose-300"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    <span className="font-serif text-xs font-bold text-amber-300">
                      BND {(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4 border-t border-amber-900/50 pt-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-serif text-amber-100/75">Total</span>
                  <span className="font-serif text-lg font-bold text-amber-300">
                    BND {cartTotalPrice.toFixed(2)}
                  </span>
                </div>
                <Link
                  to="/cart"
                  className="mt-4 block w-full rounded-lg border border-amber-500/70 bg-gradient-to-r from-amber-950/70 via-purple-950/70 to-slate-950 py-2.5 text-center font-serif text-[11px] font-bold uppercase tracking-[0.2em] text-amber-50"
                >
                  Go to Checkout
                </Link>

                <p className="mt-2 font-serif text-[10px] italic text-emerald-200/60">
                  Vendor tip: adjust stock with +1 / -1, and list items using the
                  button.
                </p>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
