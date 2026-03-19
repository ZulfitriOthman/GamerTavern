// src/pages/VendorShopPage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { TCG_LIST } from "../data/products";
import { getSocket, connectSocket } from "../socket/socketClient";
import { getCurrentUser, getUsername } from "../authStorage";

const ROLES = {
  USER: "USER",
  VENDOR: "VENDOR",
  ADMIN: "ADMIN",
};

const PLACEHOLDER = "/placeholder.png";

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
  if (v?.type === "Buffer" && Array.isArray(v?.data)) {
    return new TextDecoder().decode(new Uint8Array(v.data));
  }
  if (v instanceof ArrayBuffer)
    return new TextDecoder().decode(new Uint8Array(v));
  if (v instanceof Uint8Array) return new TextDecoder().decode(v);
  if (Buffer.isBuffer?.(v)) return v.toString("utf8");
  return String(v);
}

function getApiBase() {
  const env =
    import.meta?.env?.VITE_API_BASE && String(import.meta.env.VITE_API_BASE);
  if (env) {
    console.log("[API_BASE] Using VITE_API_BASE env:", env);
    return env;
  }

  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;

    if (
      hostname === "nanashicollectibles.com" ||
      hostname === "www.nanashicollectibles.com" ||
      hostname === "sidequest.nanashicollectibles.com"
    ) {
      const apiUrl = window.location.origin + "/api";
      console.log("[API_BASE] Using production proxy:", apiUrl);
      return apiUrl;
    }

    if (hostname !== "localhost" && hostname !== "127.0.0.1") {
      const apiUrl = `http://${hostname}:3001`;
      console.log("[API_BASE] Using local network:", apiUrl);
      return apiUrl;
    }
  }

  console.log("[API_BASE] Using localhost");
  return "http://localhost:3001";
}

const API_BASE = getApiBase();
const ASSET_BASE = API_BASE.replace(/\/api\/?$/, "");

function resolveImageSrc(url) {
  const s = toStr(url);
  if (!s) return PLACEHOLDER;

  if (/^https?:\/\//i.test(s)) return s;

  if (s.startsWith("/public/")) return `${ASSET_BASE}${s}`;

  if (s.startsWith("/")) return s;

  return PLACEHOLDER;
}

// Date filter buckets
const DATE_FILTER = {
  ALL: "ALL",
  TODAY: "TODAY",
  DAYS_7: "DAYS_7",
  DAYS_30: "DAYS_30",
};

const SORT = {
  NEWEST: "NEWEST",
  AZ: "AZ",
  ZA: "ZA",
  PRICE_ASC: "PRICE_ASC",
  PRICE_DESC: "PRICE_DESC",
  CATEGORY_AZ: "CATEGORY_AZ",
  CATEGORY_ZA: "CATEGORY_ZA",
};

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

  // socket + status
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const didInitSocketRef = useRef(false);

  // DB products loaded from socket
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [serverError, setServerError] = useState("");

  // Search / filter / sort
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState(DATE_FILTER.ALL);
  const [sortMode, setSortMode] = useState(SORT.NEWEST);

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
    category: "mtg", // ✅ CATEGORY = TCG id/name
  });

  // Manage Inventory UI state (per product)
  const [stockInput, setStockInput] = useState({});
  const getQty = (productId) => toInt(stockInput[productId], 0);

  // ----------------------------
  // Guard: must be logged in AND vendor/admin
  // ----------------------------
  useEffect(() => {
    const user = getCurrentUser();

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

  // ----------------------------
  // TCG selection from URL
  // ----------------------------
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
    [selectedTcg]
  );

  const handleSelectTcg = (id) => {
    setSelectedTcg(id);
    navigate(`/vendor/tcg/${id}`);
  };

  // ----------------------------
  // Socket helpers (wait for connect)
  // ----------------------------
  const emitAsync = (event, payload) =>
    new Promise((resolve) => {
      const s = getSocket();
      if (!s?.connected)
        return resolve({ success: false, message: "Socket not connected." });
      s.emit(event, payload, (res) => resolve(res));
    });

  // Vendor sees only their products; Admin sees all
  const loadProducts = async () => {
    if (!currentUser?.id) return;

    setLoadingProducts(true);
    setServerError("");

    const role = normalizeRole(currentUser?.role);

    const res = await emitAsync("product:list", {
      currentUser: { id: currentUser.id, role },
      ...(role === ROLES.VENDOR ? { vendorId: currentUser.id } : {}),
    });

    setLoadingProducts(false);

    if (!res?.success) {
      setServerError(res?.message || "Failed to load products.");
      return;
    }

    const rows = Array.isArray(res.data) ? res.data : [];
    const mapped = rows.map((r) => {
      const createdAt = r?.created_at || r?.CREATED_AT || null;
      return {
        id: r.id ?? r.ID,
        vendor_id: r.vendor_id ?? r.VENDOR_ID,
        seller_name: toStr(r.seller_name ?? r.SELLER_NAME),
        seller_phone: toStr(r.seller_phone ?? r.SELLER_PHONE),
        name: toStr(r.name ?? r.NAME),
        code: toStr(r.code ?? r.CODE),
        conditional: toStr(r.conditional ?? r.CONDITIONAL),
        price: toInt(r.price ?? r.PRICE),
        stock: toInt(r.stock_quantity ?? r.STOCK_QUANTITY),
        image_url: asText(r.image_url ?? r.IMAGE_URL),
        description: asText(r.description ?? r.DESCRIPTION),
        category: toStr(r.category ?? r.CATEGORY) || "Uncategorized", // ✅ CATEGORY from DB
        created_at: createdAt ? new Date(createdAt) : null,
      };
    });

    setProducts(mapped);
  };

  // Ensure socket exists (handles refresh timing)
  useEffect(() => {
    if (didInitSocketRef.current) return;
    didInitSocketRef.current = true;

    const username =
      getUsername() ||
      (currentUser?.name ? String(currentUser.name) : null);

    connectSocket(username);
  }, [currentUser?.name]);

  // Listen for connect/disconnect and load only after connect
  useEffect(() => {
    const s = getSocket();
    if (!s) return;

    const onConnect = () => {
      setIsSocketConnected(true);
      setServerError("");
      loadProducts();
    };

    const onDisconnect = () => {
      setIsSocketConnected(false);
    };

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);

    setIsSocketConnected(!!s.connected);
    if (s.connected) {
      setServerError("");
      loadProducts();
    }

    const onCreated = () => loadProducts();
    const onUpdated = () => loadProducts();
    const onDeleted = () => loadProducts();
    const onInvUpdated = () => loadProducts();

    s.on("product:created", onCreated);
    s.on("product:updated", onUpdated);
    s.on("product:deleted", onDeleted);
    s.on("inventory:updated", onInvUpdated);

    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);

      s.off("product:created", onCreated);
      s.off("product:updated", onUpdated);
      s.off("product:deleted", onDeleted);
      s.off("inventory:updated", onInvUpdated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  // ----------------------------
  // Inventory actions
  // ----------------------------
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

    setStockInput((m) => ({ ...m, [productId]: "" }));
  };

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

  // ----------------------------
  // Product actions
  // ----------------------------
  const submitAddProduct = async (e) => {
    e.preventDefault();
    if (!currentUser?.id) return;

    const payload = {
      currentUser: { id: currentUser.id, role: currentUser.role },
      vendor_id: currentUser.id,
      name: toStr(newProduct.name),
      code: toStr(newProduct.code),
      conditional: toStr(newProduct.conditional),
      price: toInt(newProduct.price),
      stock_quantity: toInt(newProduct.stock_quantity),
      image_url: toStr(newProduct.image_url),
      description: toStr(newProduct.description),
      category: toStr(newProduct.category), // ✅ CATEGORY = TCG
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
      category: selectedTcg || "mtg",
    });

    loadProducts();
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

  // ----------------------------
  // Filters / Sort
  // ----------------------------
  const categories = useMemo(() => {
    const set = new Set();
    for (const p of products) set.add(p.category || "Uncategorized");
    return ["ALL", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const passDate = (p) => {
      if (dateFilter === DATE_FILTER.ALL) return true;
      if (!p.created_at) return true;

      const t = p.created_at.getTime();
      if (dateFilter === DATE_FILTER.TODAY) return t >= startOfToday.getTime();

      const days = dateFilter === DATE_FILTER.DAYS_7 ? 7 : 30;
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      return t >= cutoff;
    };

    const list = products
      .filter((p) => (selectedTcg ? toStr(p.category) === toStr(selectedTcg) : true))
      .filter((p) => passDate(p))
      .filter((p) => {
        if (categoryFilter === "ALL") return true;
        return (p.category || "Uncategorized") === categoryFilter;
      })
      .filter((p) => {
        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          (p.category || "").toLowerCase().includes(q)
        );
      });

    const byNewest = (a, b) => {
      const at = a.created_at ? a.created_at.getTime() : 0;
      const bt = b.created_at ? b.created_at.getTime() : 0;
      return bt - at;
    };
    const byName = (a, b) => a.name.localeCompare(b.name);
    const byPrice = (a, b) => a.price - b.price;
    const byCategory = (a, b) => (a.category || "").localeCompare(b.category || "");

    const sorted = [...list];
    switch (sortMode) {
      case SORT.AZ:
        sorted.sort(byName);
        break;
      case SORT.ZA:
        sorted.sort((a, b) => byName(b, a));
        break;
      case SORT.PRICE_ASC:
        sorted.sort((a, b) => byPrice(a, b) || byName(a, b));
        break;
      case SORT.PRICE_DESC:
        sorted.sort((a, b) => byPrice(b, a) || byName(a, b));
        break;
      case SORT.CATEGORY_AZ:
        sorted.sort((a, b) => byCategory(a, b) || byName(a, b));
        break;
      case SORT.CATEGORY_ZA:
        sorted.sort((a, b) => byCategory(b, a) || byName(a, b));
        break;
      case SORT.NEWEST:
      default:
        sorted.sort((a, b) => byNewest(a, b) || byName(a, b));
        break;
    }

    return sorted;
  }, [products, selectedTcg, search, categoryFilter, dateFilter, sortMode]);

  if (!currentUser) return null;

  const isVendor =
    currentUser?.role === ROLES.VENDOR || currentUser?.role === ROLES.ADMIN;

  const tcgNameById = (id) => TCG_LIST.find((t) => t.id === id)?.name || id;

  return (
    <div className="relative flex flex-col gap-6 md:flex-row">
      {/* ✅ Match User theme glows */}
      <div className="pointer-events-none absolute -left-32 top-10 h-64 w-64 rounded-full bg-purple-900/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 bottom-0 h-72 w-72 rounded-full bg-amber-800/25 blur-3xl" />

      <section className="relative z-10 flex-1 space-y-6">
        {/* Errors */}
        {serverError ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
            {serverError}
          </div>
        ) : null}

        {/* ✅ Vendor Console (Arcane theme) */}
        <div className="rounded-2xl border border-amber-900/40 bg-gradient-to-br from-slate-950 via-purple-950/45 to-slate-950 p-5 shadow-lg shadow-purple-900/20">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-serif text-base font-bold text-amber-100">
                Vendor Console
              </h3>
              <p className="mt-1 font-serif text-[11px] italic text-amber-200/70">
                Create listings, manage stock, and sell items.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setNewProduct((p) => ({ ...p, category: selectedTcg || p.category }));
                setShowAdd(true);
              }}
              className="rounded-xl border border-amber-500/50 bg-gradient-to-r from-amber-950/40 to-slate-950 px-4 py-2 font-serif text-xs font-semibold text-amber-100 hover:border-amber-400"
            >
              + Add Product
            </button>
          </div>

          {/* Add Product panel */}
          {showAdd ? (
            <form
              onSubmit={submitAddProduct}
              className="mt-4 rounded-2xl border border-amber-700/30 bg-slate-950/40 p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="font-serif text-sm font-semibold text-amber-100">
                  New Product
                </p>
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="font-serif text-xs text-amber-200/70 hover:text-amber-200"
                >
                  Close ✕
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-serif text-xs text-amber-100/80">
                    Name
                  </label>
                  <input
                    value={newProduct.name}
                    onChange={(e) =>
                      setNewProduct((p) => ({ ...p, name: e.target.value }))
                    }
                    className="w-full rounded-lg border border-amber-900/40 bg-slate-950 px-3 py-2 font-serif text-sm text-amber-50"
                    placeholder="e.g. MTG Booster Pack"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-serif text-xs text-amber-100/80">
                    TCG Name (CATEGORY)
                  </label>
                  <select
                    value={newProduct.category}
                    onChange={(e) =>
                      setNewProduct((p) => ({ ...p, category: e.target.value }))
                    }
                    className="w-full rounded-lg border border-amber-900/40 bg-slate-950 px-3 py-2 font-serif text-sm text-amber-50"
                  >
                    {TCG_LIST.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block font-serif text-xs text-amber-100/80">
                    Code
                  </label>
                  <input
                    value={newProduct.code}
                    onChange={(e) =>
                      setNewProduct((p) => ({ ...p, code: e.target.value }))
                    }
                    className="w-full rounded-lg border border-amber-900/40 bg-slate-950 px-3 py-2 font-serif text-sm text-amber-50"
                    placeholder="e.g. MTG-BST-001"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-serif text-xs text-amber-100/80">
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
                    className="w-full rounded-lg border border-amber-900/40 bg-slate-950 px-3 py-2 font-serif text-sm text-amber-50"
                  >
                    <option value="NEW">NEW</option>
                    <option value="USED">USED</option>
                    <option value="SEALED">SEALED</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block font-serif text-xs text-amber-100/80">
                      Price (BND)
                    </label>
                    <input
                      type="number"
                      value={newProduct.price}
                      onChange={(e) =>
                        setNewProduct((p) => ({ ...p, price: e.target.value }))
                      }
                      className="w-full rounded-lg border border-amber-900/40 bg-slate-950 px-3 py-2 font-serif text-sm text-amber-50"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block font-serif text-xs text-amber-100/80">
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
                      className="w-full rounded-lg border border-amber-900/40 bg-slate-950 px-3 py-2 font-serif text-sm text-amber-50"
                    />
                  </div>
                </div>

                {/* Image upload (logic unchanged) */}
                <div className="sm:col-span-2">
                  <label className="mb-1 block font-serif text-xs text-amber-100/80">
                    Product Image
                  </label>

                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;

                      try {
                        setServerError("");

                        const fileName = file.name.toLowerCase();
                        const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
                        const hasImageExt = imageExtensions.some((ext) =>
                          fileName.endsWith(ext)
                        );
                        const hasImageType = file.type && file.type.startsWith("image/");

                        if (!hasImageExt && !hasImageType) {
                          throw new Error(
                            `Invalid file. Expected image but got: ${file.type || "unknown"}`
                          );
                        }

                        if (file.size > 5 * 1024 * 1024) {
                          throw new Error("Max image size is 5MB.");
                        }

                        const base64Data = await new Promise((resolve, reject) => {
                          const reader = new FileReader();
                          reader.onload = () => {
                            const result = reader.result;
                            const base64 = String(result).split(",")[1];
                            resolve(base64);
                          };
                          reader.onerror = reject;
                          reader.readAsDataURL(file);
                        });

                        const result = await new Promise((resolve) => {
                          const s = getSocket();
                          if (!s?.connected) {
                            return resolve({
                              success: false,
                              message: "Socket not connected",
                            });
                          }

                          s.emit(
                            "image:upload",
                            {
                              currentUser: { id: currentUser.id, role: currentUser.role },
                              fileName: file.name,
                              base64: base64Data,
                            },
                            (res) => resolve(res)
                          );
                        });

                        if (!result?.success) {
                          throw new Error(result?.message || "Upload failed on server");
                        }

                        setNewProduct((p) => ({
                          ...p,
                          image_url: result.imageUrl,
                        }));

                        e.target.value = "";
                      } catch (err) {
                        setServerError(err?.message || "Failed to upload image.");
                      }
                    }}
                    className="w-full rounded-lg border border-amber-900/40 bg-slate-950 px-3 py-2 font-serif text-sm text-amber-50"
                  />

                  {newProduct.image_url ? (
                    <div className="mt-2 flex items-center gap-3">
                      <img
                        src={resolveImageSrc(newProduct.image_url)}
                        alt="Preview"
                        className="h-14 w-14 rounded-lg object-cover border border-amber-900/40"
                        onError={(e) => (e.currentTarget.src = PLACEHOLDER)}
                      />
                      <span className="font-serif text-[11px] text-amber-200/70">
                        Saved: {newProduct.image_url}
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block font-serif text-xs text-amber-100/80">
                    Description
                  </label>
                  <textarea
                    value={newProduct.description}
                    onChange={(e) =>
                      setNewProduct((p) => ({ ...p, description: e.target.value }))
                    }
                    className="min-h-[90px] w-full rounded-lg border border-amber-900/40 bg-slate-950 px-3 py-2 font-serif text-sm text-amber-50"
                    placeholder="Short description..."
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="rounded-xl border border-amber-900/40 bg-slate-950/50 px-4 py-2 font-serif text-xs text-amber-100/80 hover:border-amber-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl border border-amber-500/50 bg-gradient-to-r from-amber-950/40 to-slate-950 px-4 py-2 font-serif text-xs font-semibold text-amber-100 hover:border-amber-400"
                >
                  Create Product
                </button>
              </div>
            </form>
          ) : null}
        </div>

        {/* ✅ TCG selector */}
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
                    ? "border-amber-500/80 bg-gradient-to-br from-amber-950/70 via-purple-950/50 to-slate-950 shadow-xl shadow-amber-900/40 ring-1 ring-amber-400/60"
                    : "border-amber-900/40 bg-gradient-to-br from-slate-950 to-purple-950/40 hover:border-amber-500/60 hover:shadow-lg hover:shadow-purple-900/30",
                ].join(" ")}
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.15),_transparent_55%)] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

                <div className="relative flex items-center justify-between gap-3">
                  <span className="font-serif text-[10px] uppercase tracking-[0.18em] text-amber-500">
                    Trading Card Game
                  </span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-amber-500/50 bg-slate-950/80 text-xs font-bold text-amber-200 shadow-inner shadow-amber-900/60">
                    {initial}
                  </div>
                </div>

                <span className="relative mt-1 font-serif text-sm font-semibold text-amber-50">
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

        {/* Marketplace controls */}
        <div className="rounded-2xl border border-amber-900/40 bg-gradient-to-br from-slate-950 via-purple-950/45 to-slate-950 p-5 shadow-lg shadow-purple-900/20">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-serif text-xl font-bold text-amber-100">
                {activeTcg?.name} Products (Vendor View)
              </h3>
              <p className="mt-1 font-serif text-[11px] italic text-amber-200/70">
                Search • Filter • Sort • Stock Control
              </p>
            </div>

            <span className="rounded-full border border-amber-700/40 bg-amber-950/20 px-3 py-1 font-serif text-[10px] uppercase tracking-wide text-amber-200">
              {loadingProducts ? "Loading..." : `${filteredProducts.length} item(s)`}
            </span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-12">
            <div className="md:col-span-6">
              <div className="flex items-center gap-2 rounded-xl border border-amber-900/40 bg-slate-950/60 px-3 py-2">
                <span className="text-amber-300/80">⌕</span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name / code / category..."
                  className="w-full bg-transparent font-serif text-sm text-amber-50 placeholder:text-amber-200/40 outline-none"
                />
              </div>
            </div>

            <div className="md:col-span-3">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full rounded-xl border border-amber-900/40 bg-slate-950/60 px-3 py-2 font-serif text-sm text-amber-50"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c === "ALL" ? "All Categories" : c}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3">
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full rounded-xl border border-amber-900/40 bg-slate-950/60 px-3 py-2 font-serif text-sm text-amber-50"
              >
                <option value={DATE_FILTER.ALL}>All Dates</option>
                <option value={DATE_FILTER.TODAY}>Today</option>
                <option value={DATE_FILTER.DAYS_7}>Last 7 days</option>
                <option value={DATE_FILTER.DAYS_30}>Last 30 days</option>
              </select>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {[
              { key: SORT.NEWEST, label: "Newest" },
              { key: SORT.AZ, label: "A–Z" },
              { key: SORT.ZA, label: "Z–A" },
              { key: SORT.PRICE_ASC, label: "Price ↑" },
              { key: SORT.PRICE_DESC, label: "Price ↓" },
              { key: SORT.CATEGORY_AZ, label: "Category A–Z" },
              { key: SORT.CATEGORY_ZA, label: "Category Z–A" },
            ].map((b) => {
              const active = sortMode === b.key;
              return (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => setSortMode(b.key)}
                  className={[
                    "rounded-full border px-3 py-1.5 font-serif text-[11px] uppercase tracking-wide transition",
                    active
                      ? "border-amber-500/70 bg-amber-950/40 text-amber-100"
                      : "border-amber-900/40 bg-slate-950/40 text-amber-200/70 hover:border-amber-500/60 hover:text-amber-100",
                  ].join(" ")}
                >
                  {b.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Products grid */}
        {filteredProducts.length === 0 ? (
          <div className="rounded-xl border border-amber-900/40 bg-gradient-to-br from-slate-950 to-purple-950/40 p-6 text-sm italic text-amber-100/70">
            No products found in DB yet.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((p) => {
              const tcgLabel = tcgNameById(p.category);
              return (
                <article
                  key={p.id}
                  className="group relative flex flex-col overflow-hidden rounded-2xl border border-amber-900/40 bg-gradient-to-br from-slate-950 to-purple-950/40 shadow-lg shadow-purple-900/30 transition-all duration-200 hover:-translate-y-1 hover:border-amber-500/60 hover:shadow-2xl hover:shadow-amber-900/30"
                >
                  <div className="relative h-44 w-full overflow-hidden">
                    <img
                      src={resolveImageSrc(p.image_url)}
                      alt={p.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                      onError={(e) => (e.currentTarget.src = PLACEHOLDER)}
                    />

                    <div className="absolute left-3 top-3 flex items-center gap-2">
                      <span className="rounded-full border border-amber-500/60 bg-slate-950/80 px-2.5 py-1 font-serif text-[10px] uppercase tracking-wide text-amber-200">
                        {tcgLabel}
                      </span>

                      {p.conditional ? (
                        <span className="rounded-full border border-emerald-600/40 bg-emerald-950/25 px-2.5 py-1 font-serif text-[10px] uppercase tracking-wide text-emerald-200">
                          {p.conditional}
                        </span>
                      ) : null}
                    </div>

                    <span className="absolute bottom-3 right-3 rounded-full border border-emerald-500/60 bg-slate-950/80 px-3 py-1 font-serif text-[11px] font-semibold text-emerald-300">
                      BND {toInt(p.price).toFixed(2)}
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col gap-3 p-4">
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

                      <span className="rounded-full border border-amber-900/40 bg-slate-950/50 px-2 py-0.5 font-serif text-[10px] uppercase tracking-wide text-amber-200/80">
                        {p.code || "-"}
                      </span>
                    </div>

                    {p.seller_name || p.seller_phone ? (
                      <div className="flex flex-wrap gap-1.5 text-[10px]">
                        {p.seller_name ? (
                          <span className="rounded-full border border-sky-600/40 bg-sky-950/20 px-2 py-0.5 font-serif text-sky-200/90">
                            Seller: {p.seller_name}
                          </span>
                        ) : null}
                        {p.seller_phone ? (
                          <span className="rounded-full border border-sky-600/40 bg-sky-950/20 px-2 py-0.5 font-serif text-sky-200/90">
                            Phone: {p.seller_phone}
                          </span>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="h-px w-full bg-gradient-to-r from-transparent via-amber-700/30 to-transparent" />

                    <button
                      type="button"
                      onClick={() =>
                        addToCart({
                          id: p.id,
                          name: p.name,
                          price: toInt(p.price),
                          image: resolveImageSrc(p.image_url),
                          stock: toInt(p.stock),
                        })
                      }
                      disabled={toInt(p.stock) === 0}
                      className={[
                        "mt-1 relative inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 font-serif text-[11px] font-semibold uppercase tracking-wide",
                        toInt(p.stock) > 0
                          ? "hologram-btn border-amber-500/60 bg-gradient-to-r from-amber-950/60 to-purple-950/60 text-amber-100"
                          : "hologram-btn hologram-btn-rose border-rose-500/50 bg-gradient-to-r from-rose-950/50 to-slate-950 text-rose-100",
                        "disabled:cursor-not-allowed",
                      ].join(" ")}
                    >
                      {toInt(p.stock) === 0 ? (
                        <span className="holo-text" data-text="Out of Stock">
                          Out of Stock
                        </span>
                      ) : (
                        <span className="holo-text" data-text="Add to Cart">
                          Add to Cart
                        </span>
                      )}

                      <span className="holo-scan-line" aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      onClick={() => navigate(`/vendor/product/${p.id}`)}
                      className="inline-flex items-center justify-center rounded-xl border border-amber-900/40 bg-slate-950/40 px-3 py-2 font-serif text-[11px] font-semibold uppercase tracking-wide text-amber-200/80 hover:border-amber-500/60 hover:text-amber-100"
                    >
                      View More →
                    </button>

                    {isVendor ? (
                      <details className="group mt-1 rounded-2xl border border-amber-900/40 bg-slate-950/35">
                        <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-3">
                          <div className="flex flex-col">
                            <span className="font-serif text-[11px] font-semibold text-amber-200">
                              Manage Inventory
                            </span>
                            <span className="font-serif text-[10px] text-amber-200/60">
                              Current: {toInt(p.stock)}
                            </span>
                          </div>

                          <span className="rounded-lg border border-amber-900/40 bg-slate-950/60 px-2 py-1 font-serif text-[10px] text-amber-200/80 transition-all group-open:rotate-180">
                            ▼
                          </span>
                        </summary>

                        <div className="px-3 pb-3">
                          <div className="rounded-xl border border-amber-900/40 bg-slate-950/35 p-3">
                            <div className="mb-2 flex items-center justify-between">
                              <span className="font-serif text-[10px] uppercase tracking-[0.2em] text-amber-200/70">
                                Quantity
                              </span>

                              <span className="font-serif text-[10px] text-amber-200/50">
                                Tip: enter qty → apply
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div className="col-span-2">
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
                                  className="w-full rounded-lg border border-amber-900/40 bg-slate-950 px-3 py-2 font-serif text-[11px] text-amber-50 outline-none focus:ring-2 focus:ring-amber-500/40"
                                  placeholder="Qty"
                                />
                              </div>

                              <button
                                type="button"
                                onClick={() => applyDeltaStock(p.id, +getQty(p.id))}
                                disabled={getQty(p.id) <= 0}
                                className={[
                                  "inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 font-serif text-[11px] font-semibold transition",
                                  "active:translate-y-[1px]",
                                  getQty(p.id) <= 0
                                    ? "cursor-not-allowed border-amber-900/40 bg-slate-950/40 text-amber-100/30"
                                    : "border-amber-500/50 bg-amber-950/25 text-amber-100 hover:border-amber-400 hover:bg-amber-950/35 hover:shadow-lg hover:shadow-amber-900/20",
                                ].join(" ")}
                                title="Add qty to stock"
                              >
                                <span className="text-amber-200/80">＋</span>
                                Restock
                                <span className="text-amber-200/60">
                                  (+{getQty(p.id)})
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={() => applyDeltaStock(p.id, -getQty(p.id))}
                                disabled={getQty(p.id) <= 0 || toInt(p.stock) === 0}
                                className={[
                                  "inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 font-serif text-[11px] font-semibold transition",
                                  "active:translate-y-[1px]",
                                  getQty(p.id) <= 0 || toInt(p.stock) === 0
                                    ? "cursor-not-allowed border-amber-900/40 bg-slate-950/40 text-amber-100/30"
                                    : "border-amber-500/50 bg-amber-950/25 text-amber-100 hover:border-amber-400 hover:bg-amber-950/35 hover:shadow-lg hover:shadow-amber-900/20",
                                ].join(" ")}
                                title="Subtract qty from stock"
                              >
                                <span className="text-amber-200/80">－</span>
                                Reduce
                                <span className="text-amber-200/60">
                                  (-{getQty(p.id)})
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setExactStock(p.id, getQty(p.id), p.stock)}
                                disabled={getQty(p.id) < 0 || (stockInput[p.id] ?? "") === ""}
                                className={[
                                  "col-span-2 inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 font-serif text-[11px] font-semibold transition",
                                  "active:translate-y-[1px]",
                                  (stockInput[p.id] ?? "") === ""
                                    ? "cursor-not-allowed border-amber-900/30 bg-amber-950/10 text-amber-100/30"
                                    : "border-amber-500/40 bg-amber-950/20 text-amber-100 hover:border-amber-400 hover:bg-amber-950/30",
                                ].join(" ")}
                                title="Set stock to this exact qty"
                              >
                                Set Exact Stock
                                <span className="text-amber-200/70">→</span>
                              </button>
                            </div>
                          </div>

                          <div className="mt-3 grid grid-cols-1 gap-2">
                            <button
                              type="button"
                              onClick={() => deleteProduct(p.id)}
                              className="rounded-lg border border-rose-500/40 bg-rose-950/15 px-3 py-2 font-serif text-[11px] font-semibold text-rose-200 transition hover:border-rose-400 hover:bg-rose-950/25 active:translate-y-[1px]"
                              title="Delete product"
                            >
                              Delete Product
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => alert(`Sell / listing flow for: ${p.name}`)}
                            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/50 bg-gradient-to-r from-amber-950/25 to-slate-950 px-3 py-2 font-serif text-[11px] font-semibold uppercase tracking-wide text-amber-100 transition hover:border-amber-400 hover:shadow-lg hover:shadow-amber-900/20 active:translate-y-[1px]"
                          >
                            Sell / List Item
                            <span className="text-amber-200/70">↗</span>
                          </button>
                        </div>
                      </details>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
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
                  className="hologram-btn mt-4 relative block w-full rounded-lg border border-amber-500/70 bg-gradient-to-r from-amber-950/70 via-purple-950/70 to-slate-950 py-2.5 text-center font-serif text-[11px] font-bold uppercase tracking-[0.2em] text-amber-50"
                >
                  <span className="holo-text" data-text="Go to Checkout">
                    Go to Checkout
                  </span>
                  <span className="holo-scan-line" aria-hidden="true" />
                </Link>

                <p className="mt-2 font-serif text-[10px] italic text-amber-200/60">
                  Vendor tip: Use Restock/Reduce/Set to control quantity.
                </p>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}