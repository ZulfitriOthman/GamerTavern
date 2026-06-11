// src/pages/UserShopPage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { TCG_LIST as FALLBACK_TCG_LIST } from "../data/products";
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

const API_BASE =
  (import.meta?.env?.VITE_API_BASE && String(import.meta.env.VITE_API_BASE)) ||
  window.location.origin.replace(":5173", ":3001"); // dev fallback

function normalizeImageUrl(v) {
  const s = toStr(v);

  if (!s) return PLACEHOLDER;

  // absolute URL (https://...)
  if (/^https?:\/\//i.test(s)) return s;

  // stored as /public/uploads/...
  if (s.startsWith("/public/")) return `${API_BASE}${s}`;

  // stored as /uploads/... (if you ever change backend mount to /uploads)
  if (s.startsWith("/uploads/")) return `${API_BASE}${s}`;

  // stored as relative "uploads/..."
  if (s.startsWith("uploads/")) return `${API_BASE}/${s}`;

  // local frontend public assets like "/placeholder.png"
  if (s.startsWith("/")) return s;

  return PLACEHOLDER;
}

// Category helper: supports DB column, otherwise fallback
function deriveCategory(row) {
  const direct =
    toStr(row?.category) ||
    toStr(row?.CATEGORY) ||
    toStr(row?.product_category) ||
    toStr(row?.PRODUCT_CATEGORY);

  if (direct) return direct;

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
  STOCK_ASC: "STOCK_ASC",
  STOCK_DESC: "STOCK_DESC",
};

const LOW_STOCK_THRESHOLD = 3;
const TCG_COLOR_SWATCHES = [
  "from-purple-500 to-indigo-500",
  "from-yellow-400 to-amber-600",
  "from-sky-400 to-blue-500",
  "from-emerald-400 to-teal-500",
  "from-rose-500 to-orange-500",
  "from-cyan-400 to-indigo-500",
  "from-lime-400 to-green-600",
  "from-fuchsia-500 to-pink-500",
];

function normalizeTcgKey(value) {
  return toStr(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function findFallbackCategory(value) {
  const key = normalizeTcgKey(value);
  return FALLBACK_TCG_LIST.find(
    (item) =>
      normalizeTcgKey(item.id) === key || normalizeTcgKey(item.name) === key,
  );
}

function resolveCategoryId(idValue, nameValue) {
  const byName = findFallbackCategory(nameValue);
  if (byName?.id) return byName.id;

  const byId = findFallbackCategory(idValue);
  if (byId?.id) return byId.id;

  const id = toStr(idValue);
  if (id && !/^TCG[_-]?\d+$/i.test(id)) return id;

  const fromName = normalizeTcgKey(nameValue);
  if (fromName) return fromName;

  return id || toStr(nameValue);
}

function mapTcgCategoryRow(row, index) {
  const id = toStr(row?.id ?? row?.ID);
  const name = toStr(
    row?.name ?? row?.NAME ?? row?.tcg_categories ?? row?.TCG_CATEGORIES,
  );

  if (!id && !name) return null;

  const canonicalId = resolveCategoryId(id, name);
  const fallback = findFallbackCategory(name) || findFallbackCategory(canonicalId);

  return {
    id: canonicalId,
    name: name || id,
    color:
      fallback?.color ||
      TCG_COLOR_SWATCHES[index % TCG_COLOR_SWATCHES.length],
  };
}

function mergeTcgCategories(serverCategories) {
  const merged = [];
  const seen = new Set();

  const pushIfNew = (item) => {
    const key = normalizeTcgKey(item?.name) || normalizeTcgKey(item?.id);
    if (!key || seen.has(key)) return;
    seen.add(key);
    merged.push(item);
  };

  for (const item of serverCategories || []) {
    if (item) pushIfNew(item);
  }

  for (const item of FALLBACK_TCG_LIST) {
    pushIfNew(item);
  }

  return merged;
}

function matchesSelectedTcg(categoryValue, selectedTcg, activeTcg) {
  const categoryKey = normalizeTcgKey(categoryValue);
  if (!selectedTcg) return true;
  if (!categoryKey) return false;

  const selectedKey = normalizeTcgKey(selectedTcg);
  if (categoryKey === selectedKey) return true;

  if (activeTcg) {
    const activeIdKey = normalizeTcgKey(activeTcg.id);
    const activeNameKey = normalizeTcgKey(activeTcg.name);
    if (categoryKey === activeIdKey || categoryKey === activeNameKey) return true;
  }

  return false;
}

function formatCurrency(value) {
  return `BND ${toInt(value).toFixed(2)}`;
}

function formatDateShort(value) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function getStockTone(stock) {
  const qty = toInt(stock);
  if (qty <= 0) return "border-rose-600/40 bg-rose-950/20 text-rose-200";
  if (qty <= LOW_STOCK_THRESHOLD) {
    return "border-amber-600/40 bg-amber-950/20 text-amber-200";
  }
  return "border-emerald-600/40 bg-emerald-950/20 text-emerald-200";
}

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
  const [tcgList, setTcgList] = useState(() => [...FALLBACK_TCG_LIST]);
  const [loadingTcg, setLoadingTcg] = useState(false);
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [serverError, setServerError] = useState("");

  // UI state
  const [selectedTcg, setSelectedTcg] = useState(() => {
    if (tcgId) return tcgId;
    return FALLBACK_TCG_LIST[0]?.id || "";
  });

  const [search, setSearch] = useState("");
  const [conditionFilter, setConditionFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState(DATE_FILTER.ALL);
  const [sortMode, setSortMode] = useState(SORT.NEWEST);

  const didInitSocketRef = useRef(false);

  // ✅ Guard: must be logged in AND role USER
  useEffect(() => {
    const user = getCurrentUser();

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
    if (tcgList.some((t) => normalizeTcgKey(t.id) === normalizeTcgKey(tcgId))) {
      setSelectedTcg(tcgId);
    }
  }, [tcgId, tcgList]);

  useEffect(() => {
    if (!tcgList.length) return;

    const hasSelected = tcgList.some(
      (t) => normalizeTcgKey(t.id) === normalizeTcgKey(selectedTcg),
    );

    if (!hasSelected) {
      setSelectedTcg(tcgList[0].id);
    }
  }, [selectedTcg, tcgList]);

  const activeTcg = useMemo(
    () =>
      tcgList.find(
        (t) => normalizeTcgKey(t.id) === normalizeTcgKey(selectedTcg),
      ) || null,
    [selectedTcg, tcgList],
  );

  const handleSelectTcg = (id) => {
    setSelectedTcg(id);
    navigate(`/user/tcg/${encodeURIComponent(id)}`);
  };

  // ----------------------------
  // Socket helpers
  // ----------------------------
  const emitAsync = (event, payload) =>
    new Promise((resolve) => {
      const s = getSocket();
      if (!s?.connected)
        return resolve({ success: false, message: "Socket not connected." });
      s.emit(event, payload, (res) => resolve(res));
    });

  const loadProducts = async () => {
    setLoadingProducts(true);
    setServerError("");

    const res = await emitAsync("product:list", {});

    setLoadingProducts(false);

    if (!res?.success) {
      setServerError(res?.message || "Failed to load products.");
      return;
    }

    const rows = Array.isArray(res.data) ? res.data : [];
    const mapped = rows.map((r) => {
      const createdAt = r?.created_at || r?.CREATED_AT || null;

      const rawImage = asText(r.image_url ?? r.IMAGE_URL);
      const img = normalizeImageUrl(rawImage);

      const category = deriveCategory({
        category: r.category,
        CATEGORY: r.CATEGORY,
        product_category: r.product_category,
        PRODUCT_CATEGORY: r.PRODUCT_CATEGORY,
        code: r.code ?? r.CODE,
      });

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
        image: img,
        description: asText(r.description ?? r.DESCRIPTION),
        category,
        created_at: createdAt ? new Date(createdAt) : null,
      };
    });

    setProducts(mapped);
  };

  const loadTcgCategories = async () => {
    setLoadingTcg(true);

    const res = await emitAsync("tcgcategories:list", {});

    setLoadingTcg(false);

    if (!res?.success || !Array.isArray(res.data)) {
      return;
    }

    const serverCategories = res.data
      .map((row, index) => mapTcgCategoryRow(row, index))
      .filter(Boolean);

    const merged = mergeTcgCategories(serverCategories);
    if (merged.length) setTcgList(merged);
  };

  // ✅ Ensure socket is connected (handles refresh timing)
  useEffect(() => {
    if (didInitSocketRef.current) return;
    didInitSocketRef.current = true;

    const username =
      getUsername() || (currentUser?.name ? String(currentUser.name) : null);

    connectSocket(username);
  }, [currentUser?.name]);

  // ✅ Listen connect/disconnect and only load after connect
  useEffect(() => {
    const s = getSocket();
    if (!s) return;

    const onConnect = () => {
      setIsSocketConnected(true);
      setServerError("");
      loadTcgCategories();
      loadProducts();
    };

    const onDisconnect = () => {
      setIsSocketConnected(false);
    };

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);

    // initialize current status
    setIsSocketConnected(!!s.connected);
    if (s.connected) {
      setServerError("");
      loadTcgCategories();
      loadProducts();
    }

    // realtime updates
    const onCreated = () => loadProducts();
    const onUpdated = () => loadProducts();
    const onDeleted = () => loadProducts();
    const onInvUpdated = () => loadProducts();
    const onCategoriesUpdated = (categories) => {
      const serverCategories = (Array.isArray(categories) ? categories : [])
        .map((row, index) => mapTcgCategoryRow(row, index))
        .filter(Boolean);
      const merged = mergeTcgCategories(serverCategories);
      if (merged.length) setTcgList(merged);
    };

    s.on("product:created", onCreated);
    s.on("product:updated", onUpdated);
    s.on("product:deleted", onDeleted);
    s.on("inventory:updated", onInvUpdated);
    s.on("tcgcategories:updated", onCategoriesUpdated);

    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);

      s.off("product:created", onCreated);
      s.off("product:updated", onUpdated);
      s.off("product:deleted", onDeleted);
      s.off("inventory:updated", onInvUpdated);
      s.off("tcgcategories:updated", onCategoriesUpdated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----------------------------
  // ✅ TCG FILTER (same spirit as vendor: CATEGORY is the TCG name)
  // ----------------------------
  const tcgFilteredProducts = useMemo(() => {
    if (!selectedTcg) return products;
    return products.filter((p) =>
      matchesSelectedTcg(p.category, selectedTcg, activeTcg),
    );
  }, [products, selectedTcg, activeTcg]);

  // ----------------------------
  // Filters / Sort (applies after TCG filter)
  // ----------------------------
  const conditionOptions = useMemo(() => {
    const set = new Set();
    for (const p of tcgFilteredProducts) set.add(p.conditional || "Unknown");
    return ["ALL", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [tcgFilteredProducts]);

  const shopperStats = useMemo(() => {
    const inventoryUnits = tcgFilteredProducts.reduce(
      (sum, item) => sum + toInt(item.stock),
      0,
    );
    const readyToBuyCount = tcgFilteredProducts.filter(
      (item) => toInt(item.stock) > 0,
    ).length;
    const lowStockCount = tcgFilteredProducts.filter(
      (item) => toInt(item.stock) > 0 && toInt(item.stock) <= LOW_STOCK_THRESHOLD,
    ).length;
    const averagePrice = tcgFilteredProducts.length
      ? tcgFilteredProducts.reduce((sum, item) => sum + toInt(item.price), 0) /
        tcgFilteredProducts.length
      : 0;

    return {
      listingCount: tcgFilteredProducts.length,
      inventoryUnits,
      readyToBuyCount,
      lowStockCount,
      averagePrice,
    };
  }, [tcgFilteredProducts]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();

    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );

    const passDate = (p) => {
      if (dateFilter === DATE_FILTER.ALL) return true;
      if (!p.created_at) return true;

      const t = p.created_at.getTime();
      if (dateFilter === DATE_FILTER.TODAY) return t >= startOfToday.getTime();

      const days = dateFilter === DATE_FILTER.DAYS_7 ? 7 : 30;
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      return t >= cutoff;
    };

    const list = tcgFilteredProducts
      .filter((p) => passDate(p))
      .filter((p) => {
        if (conditionFilter === "ALL") return true;
        return (p.conditional || "Unknown") === conditionFilter;
      })
      .filter((p) => {
        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          (p.category || "").toLowerCase().includes(q) ||
          (p.description || "").toLowerCase().includes(q)
        );
      });

    const byNewest = (a, b) => {
      const at = a.created_at ? a.created_at.getTime() : 0;
      const bt = b.created_at ? b.created_at.getTime() : 0;
      return bt - at;
    };

    const byName = (a, b) => a.name.localeCompare(b.name);
    const byPrice = (a, b) => a.price - b.price;
    const byStock = (a, b) => toInt(a.stock) - toInt(b.stock);

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
      case SORT.STOCK_ASC:
        sorted.sort((a, b) => byStock(a, b) || byName(a, b));
        break;
      case SORT.STOCK_DESC:
        sorted.sort((a, b) => byStock(b, a) || byName(a, b));
        break;
      case SORT.NEWEST:
      default:
        sorted.sort((a, b) => byNewest(a, b) || byName(a, b));
        break;
    }

    return sorted;
  }, [tcgFilteredProducts, search, conditionFilter, dateFilter, sortMode]);

  if (!currentUser) return null;

  return (
    <div className="relative flex flex-col gap-6 xl:flex-row">
      {/* glows */}
      <div className="pointer-events-none absolute -left-32 top-10 h-64 w-64 rounded-full bg-purple-900/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 bottom-0 h-72 w-72 rounded-full bg-amber-800/25 blur-3xl" />

      {/* LEFT */}
      <section className="relative z-10 flex-1 space-y-6">
        {/* Errors */}
        {serverError ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
            {serverError}
          </div>
        ) : null}

        {/* TCG selector */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {tcgList.map((tcg) => {
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

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "Listings",
              value: shopperStats.listingCount,
              tone: "text-amber-100",
            },
            {
              label: "Ready To Buy",
              value: shopperStats.readyToBuyCount,
              tone: "text-emerald-200",
            },
            {
              label: "Units In Stock",
              value: shopperStats.inventoryUnits,
              tone: "text-sky-200",
            },
            {
              label: "Avg Price / Low Stock",
              value: `${formatCurrency(shopperStats.averagePrice)} / ${shopperStats.lowStockCount}`,
              tone: "text-rose-200",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-amber-900/40 bg-gradient-to-br from-slate-950/90 via-purple-950/35 to-slate-950 p-4 shadow-lg shadow-purple-900/15"
            >
              <p className="font-serif text-[10px] uppercase tracking-[0.24em] text-amber-300/70">
                {item.label}
              </p>
              <p className={`mt-3 font-serif text-2xl font-bold ${item.tone}`}>
                {item.value}
              </p>
              <p className="mt-1 text-[11px] text-amber-100/55">
                Based on {activeTcg?.name || "your selected TCG"} listings.
              </p>
            </div>
          ))}
        </div>

        {/* Marketplace header + controls */}
        <div className="rounded-2xl border border-amber-900/40 bg-gradient-to-br from-slate-950 via-purple-950/45 to-slate-950 p-5 shadow-lg shadow-purple-900/20">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-serif text-xl font-bold text-amber-100">
                {activeTcg?.name} Marketplace
              </h3>
              <p className="mt-1 font-serif text-[11px] italic text-amber-200/70">
                CATEGORY-driven TCG view • Search • Filter • Sort
              </p>
            </div>

            <div className="flex items-center gap-2">
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

              <span className="rounded-full border border-amber-700/40 bg-amber-950/20 px-3 py-1 font-serif text-[10px] uppercase tracking-wide text-amber-200">
                {loadingProducts || loadingTcg
                  ? "Loading..."
                  : `${filteredProducts.length} item(s)`}
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
                value={conditionFilter}
                onChange={(e) => setConditionFilter(e.target.value)}
                className="w-full rounded-xl border border-amber-900/40 bg-slate-950/60 px-3 py-2 font-serif text-sm text-amber-50"
              >
                {conditionOptions.map((condition) => (
                  <option key={condition} value={condition}>
                    {condition === "ALL" ? "All Conditions" : condition}
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
              { key: SORT.STOCK_ASC, label: "Stock ↑" },
              { key: SORT.STOCK_DESC, label: "Stock ↓" },
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
            No products found for this TCG (CATEGORY = "{selectedTcg || "-"}
            ").
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
                    <span
                      className={[
                        "rounded-full border px-2 py-0.5 font-serif text-[10px] uppercase tracking-wide",
                        getStockTone(p.stock),
                      ].join(" ")}
                    >
                      {toInt(p.stock) <= 0
                        ? "Sold Out"
                        : toInt(p.stock) <= LOW_STOCK_THRESHOLD
                          ? `Low Stock: ${toInt(p.stock)}`
                          : `In Stock: ${toInt(p.stock)}`}
                    </span>

                    <span className="rounded-full border border-amber-900/40 bg-slate-950/50 px-2 py-0.5 font-serif text-[10px] uppercase tracking-wide text-amber-200/80">
                      {p.code || "-"}
                    </span>
                  </div>

                  <p className="line-clamp-2 text-xs leading-relaxed text-amber-100/65">
                    {p.description || "No description added yet."}
                  </p>

                  <div className="flex items-center justify-between text-[10px] text-amber-100/55">
                    <span>Created {formatDateShort(p.created_at)}</span>
                    <span>{formatCurrency(p.price)}</span>
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

                  <button
                    type="button"
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
                    className={[
                      "mt-2 relative inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 font-serif text-[11px] font-semibold uppercase tracking-wide",
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
                    onClick={() => navigate(`/product/${p.id}`)}
                    className="mt-2 inline-flex items-center justify-center rounded-xl border border-amber-900/40 bg-slate-950/40 px-3 py-2 font-serif text-[11px] font-semibold uppercase tracking-wide text-amber-200/80 hover:border-amber-500/60 hover:text-amber-100"
                  >
                    View More →
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* RIGHT cart */}
      <aside className="relative z-10 mt-2 w-full max-w-none xl:mt-0 xl:w-80 xl:max-w-sm">
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
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
