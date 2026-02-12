// src/pages/UserShopPage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { TCG_LIST } from "../data/products";
import { getSocket, connectSocket } from "../socket/socketClient";

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
  if (v instanceof ArrayBuffer) return new TextDecoder().decode(new Uint8Array(v));
  if (v instanceof Uint8Array) return new TextDecoder().decode(v);
  if (Buffer.isBuffer?.(v)) return v.toString("utf8");
  return String(v);
}

function normalizeImageUrl(v) {
  const s = toStr(v);
  if (!s) return PLACEHOLDER;
  if (/^https?:\/\//i.test(s)) return s; // absolute
  if (s.startsWith("/")) return s; // /uploads/... or /public/... or /images/...
  return PLACEHOLDER;
}

// Category helper: supports future DB column, otherwise fallback
function deriveCategory(row) {
  // if you later add PRODUCTS.CATEGORY, it will map into row.category automatically if your socket includes it.
  const direct =
    toStr(row?.category) ||
    toStr(row?.CATEGORY) ||
    toStr(row?.product_category) ||
    toStr(row?.PRODUCT_CATEGORY);

  if (direct) return direct;

  // OPTIONAL heuristic: if CODE looks like "SLEEVE-001", use prefix as category
  const code = toStr(row?.code || row?.CODE);
  if (code.includes("-")) return code.split("-")[0].toUpperCase();

  return "Uncategorized";
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

export default function UserShopPage({
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

  // socket + data
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [serverError, setServerError] = useState("");

  // UI state
  const [selectedTcg, setSelectedTcg] = useState(() => {
    if (tcgId && TCG_LIST.some((t) => t.id === tcgId)) return tcgId;
    return "mtg";
  });

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState(DATE_FILTER.ALL);
  const [sortMode, setSortMode] = useState(SORT.NEWEST);

  const didInitSocketRef = useRef(false);

  // ✅ Guard: must be logged in AND role USER
  useEffect(() => {
    const raw = localStorage.getItem("tavern_current_user");
    const user = raw ? JSON.parse(raw) : null;

    if (!user?.id) {
      navigate("/login");
      return;
    }

    user.role = normalizeRole(user?.role);

    // If vendor/admin tries to access user page, redirect to vendor page
    if (user.role === ROLES.VENDOR || user.role === ROLES.ADMIN) {
      navigate("/vendor/tcg/mtg");
      return;
    }

    setCurrentUser(user);
  }, [navigate]);

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
    navigate(`/user/tcg/${id}`);
  };

  // ----------------------------
  // Socket helpers
  // ----------------------------
  const emitAsync = (event, payload) =>
    new Promise((resolve) => {
      const s = getSocket();
      if (!s?.connected) return resolve({ success: false, message: "Socket not connected." });
      s.emit(event, payload, (res) => resolve(res));
    });

  const loadProducts = async () => {
    setLoadingProducts(true);
    setServerError("");

    const res = await emitAsync("product:list", {
      // optional filters later:
      // tcg: selectedTcg, // (DB has no tcg column yet)
      // vendorId: ...
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
        name: toStr(r.name ?? r.NAME),
        code: toStr(r.code ?? r.CODE),
        conditional: toStr(r.conditional ?? r.CONDITIONAL),
        price: toInt(r.price ?? r.PRICE),
        stock: toInt(r.stock_quantity ?? r.STOCK_QUANTITY),
        image: normalizeImageUrl(asText(r.image_url ?? r.IMAGE_URL)),
        description: asText(r.description ?? r.DESCRIPTION),
        category: deriveCategory({
          category: r.category,
          CATEGORY: r.CATEGORY,
          product_category: r.product_category,
          PRODUCT_CATEGORY: r.PRODUCT_CATEGORY,
          code: r.code ?? r.CODE,
        }),
        created_at: createdAt ? new Date(createdAt) : null,
      };
    });

    setProducts(mapped);
  };

  // ✅ Ensure socket is connected (handles refresh timing)
  useEffect(() => {
    if (didInitSocketRef.current) return;
    didInitSocketRef.current = true;

    // If App already connects, this is safe (connectSocket returns existing socket)
    const username =
      localStorage.getItem("tavern_username") ||
      (currentUser?.name ? String(currentUser.name) : null);

    connectSocket(username);
  }, [currentUser?.name]);

  // ✅ Listen connect/disconnect and only load after connect
  useEffect(() => {
    const s = getSocket();
    if (!s) return;

    const onConnect = () => {
      setIsSocketConnected(true);
      setServerError(""); // ✅ clear stale "Socket not connected" after refresh
      loadProducts(); // ✅ load only after connected
    };

    const onDisconnect = () => {
      setIsSocketConnected(false);
      // keep UI calm; no hard error spam
    };

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);

    // initialize current status
    setIsSocketConnected(!!s.connected);
    if (s.connected) {
      setServerError("");
      loadProducts();
    }

    // realtime updates
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
  }, []);

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
      if (!p.created_at) return true; // if missing date, don't hide it

      const t = p.created_at.getTime();

      if (dateFilter === DATE_FILTER.TODAY) return t >= startOfToday.getTime();

      const days = dateFilter === DATE_FILTER.DAYS_7 ? 7 : 30;
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      return t >= cutoff;
    };

    const list = products
      // (TCG filter placeholder — when DB has tcg column, filter here)
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
  }, [products, search, categoryFilter, dateFilter, sortMode]);

  if (!currentUser) return null;

  return (
    <div className="relative flex flex-col gap-6 md:flex-row">
      {/* glows */}
      <div className="pointer-events-none absolute -left-32 top-10 h-64 w-64 rounded-full bg-purple-900/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 bottom-0 h-72 w-72 rounded-full bg-amber-800/25 blur-3xl" />

      {/* LEFT */}
      <section className="relative z-10 flex-1 space-y-6">
        {/* Banner */}
        <div className="overflow-hidden rounded-2xl border border-amber-900/40 bg-gradient-to-br from-slate-950 via-purple-950/45 to-slate-950 p-4 shadow-lg shadow-purple-900/20">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-serif text-xs text-amber-100/70">
                Logged in as{" "}
                <span className="font-semibold text-amber-200">
                  {currentUser?.name}
                </span>
              </p>
              <p className="font-serif text-[11px] uppercase tracking-[0.25em] text-amber-500">
                ROLE: {currentUser?.role}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-full border border-sky-600/40 bg-sky-950/30 px-3 py-1 font-serif text-[10px] uppercase tracking-wide text-sky-200">
                User Mode: Buy Only
              </span>

              <span
                className={[
                  "rounded-full border px-3 py-1 font-serif text-[10px] uppercase tracking-wide",
                  isSocketConnected
                    ? "border-emerald-600/40 bg-emerald-950/30 text-emerald-200"
                    : "border-rose-600/40 bg-rose-950/30 text-rose-200",
                ].join(" ")}
                title="Socket connection status"
              >
                {isSocketConnected ? "Live" : "Offline"}
              </span>

              <button
                type="button"
                onClick={loadProducts}
                className="rounded-full border border-amber-700/40 bg-amber-950/20 px-3 py-1 font-serif text-[10px] uppercase tracking-wide text-amber-200 hover:border-amber-500"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Errors (only show real errors; not the early refresh flicker) */}
        {serverError ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
            {serverError}
          </div>
        ) : null}

        {/* TCG selector */}
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

                <span className="relative mt-1 font-serif text-sm font-semibold leading-snug text-amber-50">
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

        {/* Marketplace header + controls */}
        <div className="rounded-2xl border border-amber-900/40 bg-gradient-to-br from-slate-950 via-purple-950/45 to-slate-950 p-5 shadow-lg shadow-purple-900/20">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-serif text-xl font-bold text-amber-100">
                {activeTcg?.name} Marketplace
              </h3>
              <p className="mt-1 font-serif text-[11px] italic text-amber-200/70">
                Live vendor inventory • Search • Filter • Sort
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-full border border-amber-700/40 bg-amber-950/20 px-3 py-1 font-serif text-[10px] uppercase tracking-wide text-amber-200">
                {loadingProducts ? "Loading..." : `${filteredProducts.length} item(s)`}
              </span>
            </div>
          </div>

          {/* Controls row */}
          <div className="mt-4 grid gap-3 md:grid-cols-12">
            {/* Search */}
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

            {/* Category */}
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

            {/* Date */}
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

          {/* Sort buttons */}
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

        {/* Products */}
        {filteredProducts.length === 0 ? (
          <div className="rounded-xl border border-amber-900/40 bg-gradient-to-br from-slate-950 to-purple-950/40 p-6 text-sm italic text-amber-100/70">
            No products found (try changing category / search / date / sort).
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((p) => (
              <article
                key={p.id}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-amber-900/40 bg-gradient-to-br from-slate-950 to-purple-950/40 shadow-lg shadow-purple-900/30 transition-all duration-200 hover:-translate-y-1 hover:border-amber-500/60 hover:shadow-2xl hover:shadow-amber-900/30"
              >
                <div className="relative h-44 w-full overflow-hidden">
                  <img
                    src={p.image}
                    alt={p.name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                    onError={(e) => (e.currentTarget.src = PLACEHOLDER)}
                  />

                  <div className="absolute left-3 top-3 flex items-center gap-2">
                    <span className="rounded-full border border-amber-500/60 bg-slate-950/80 px-2.5 py-1 font-serif text-[10px] uppercase tracking-wide text-amber-200">
                      {p.category || "Uncategorized"}
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
                    <span className="rounded-full border border-amber-900/40 bg-slate-950/50 px-2 py-0.5 font-serif text-[10px] uppercase tracking-wide text-amber-200/80">
                      {p.code || "-"}
                    </span>
                  </div>

                  <button
                    onClick={() =>
                      addToCart({
                        id: p.id,
                        name: p.name,
                        price: toInt(p.price),
                        image: p.image,
                        stock: toInt(p.stock),
                      })
                    }
                    disabled={toInt(p.stock) === 0}
                    className="mt-2 inline-flex items-center justify-center rounded-xl border border-amber-500/60 bg-gradient-to-r from-amber-950/60 to-purple-950/60 px-3 py-2 font-serif text-[11px] font-semibold uppercase tracking-wide text-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {toInt(p.stock) === 0 ? "Out of Stock" : "Add to Cart"}
                  </button>
                </div>
              </article>
            ))}
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
                  className="mt-4 block w-full rounded-lg border border-amber-500/70 bg-gradient-to-r from-amber-950/70 via-purple-950/70 to-slate-950 py-2.5 text-center font-serif text-[11px] font-bold uppercase tracking-[0.2em] text-amber-50"
                >
                  Go to Checkout
                </Link>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
