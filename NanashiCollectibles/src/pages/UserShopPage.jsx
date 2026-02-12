// src/pages/UserShopPage.jsx
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

const toStr = (v) => (v == null ? "" : String(v)).trim();
const toInt = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

// Try to normalize image paths from DB
function normalizeImageUrl(v) {
  const s = toStr(v);
  if (!s) return PLACEHOLDER;
  if (/^https?:\/\//i.test(s)) return s; // absolute
  if (s.startsWith("/")) return s; // public/static
  return PLACEHOLDER;
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

  // DB products
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [serverError, setServerError] = useState("");

  // TCG selection
  const [selectedTcg, setSelectedTcg] = useState(() => {
    if (tcgId && TCG_LIST.some((t) => t.id === tcgId)) return tcgId;
    return "mtg";
  });

  // Sorting / Filtering
  const [sortMode, setSortMode] = useState("NEWEST"); // NEWEST | AZ | PRICE_ASC | PRICE_DESC | CAT_AZ | CAT_ZA
  const [categoryFilter, setCategoryFilter] = useState("ALL"); // ALL or category name
  const [search, setSearch] = useState("");

  // ----------------------------
  // ✅ Guard: must be logged in AND role USER
  // ----------------------------
  useEffect(() => {
    const raw = localStorage.getItem("tavern_current_user");
    const user = raw ? JSON.parse(raw) : null;

    if (!user?.id) {
      navigate("/login");
      return;
    }

    const role = String(user?.role || ROLES.USER).toUpperCase();
    user.role = Object.values(ROLES).includes(role) ? role : ROLES.USER;

    // vendor/admin shouldn't be here
    if (user.role === ROLES.VENDOR || user.role === ROLES.ADMIN) {
      navigate("/vendor");
      return;
    }

    setCurrentUser(user);
  }, [navigate]);

  // keep selected tcg in sync with route param
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
      // if you want server to filter by active inventory only, add flags later
    });

    setLoadingProducts(false);

    if (!res?.success) {
      setServerError(res?.message || "Failed to load products.");
      return;
    }

    const rows = Array.isArray(res.data) ? res.data : [];

    const mapped = rows.map((r) => ({
      id: r.id,
      name: toStr(r.name),
      code: toStr(r.code),
      // ✅ add category field (must come from DB)
      category: toStr(r.category) || "Uncategorized",
      // ✅ if you later add tcg column, map it here:
      tcg: toStr(r.tcg) || "mtg",
      price: toInt(r.price),
      stock: toInt(r.stock_quantity),
      image: normalizeImageUrl(r.image_url),
      // ✅ requires backend to send created_at
      created_at: r.created_at || null,
    }));

    setProducts(mapped);
  };

  // initial load + realtime updates
  useEffect(() => {
    if (!currentUser?.id) return;

    const s = getSocket();
    if (!s) return;

    loadProducts();

    const reload = () => loadProducts();

    s.on("product:created", reload);
    s.on("product:updated", reload);
    s.on("product:deleted", reload);
    s.on("inventory:updated", reload);

    return () => {
      s.off("product:created", reload);
      s.off("product:updated", reload);
      s.off("product:deleted", reload);
      s.off("inventory:updated", reload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  // ----------------------------
  // Category list (for dropdown)
  // ----------------------------
  const categories = useMemo(() => {
    const set = new Set();
    for (const p of products) {
      if ((p.tcg || "mtg") === selectedTcg) set.add(p.category || "Uncategorized");
    }
    return ["ALL", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [products, selectedTcg]);

  // ----------------------------
  // Filter + Search + Sort
  // ----------------------------
  const filteredProducts = useMemo(() => {
    let list = products.filter((p) => (p.tcg || "mtg") === selectedTcg);

    // category filter
    if (categoryFilter !== "ALL") {
      list = list.filter((p) => (p.category || "Uncategorized") === categoryFilter);
    }

    // search
    const q = toStr(search).toLowerCase();
    if (q) {
      list = list.filter((p) => {
        const name = (p.name || "").toLowerCase();
        const code = (p.code || "").toLowerCase();
        const cat = (p.category || "").toLowerCase();
        return name.includes(q) || code.includes(q) || cat.includes(q);
      });
    }

    // sort
    const copy = [...list];
    if (sortMode === "NEWEST") {
      copy.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    } else if (sortMode === "AZ") {
      copy.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    } else if (sortMode === "PRICE_ASC") {
      copy.sort((a, b) => toInt(a.price) - toInt(b.price));
    } else if (sortMode === "PRICE_DESC") {
      copy.sort((a, b) => toInt(b.price) - toInt(a.price));
    } else if (sortMode === "CAT_AZ") {
      copy.sort((a, b) => (a.category || "").localeCompare(b.category || ""));
    } else if (sortMode === "CAT_ZA") {
      copy.sort((a, b) => (b.category || "").localeCompare(a.category || ""));
    }

    return copy;
  }, [products, selectedTcg, categoryFilter, search, sortMode]);

  if (!currentUser) return null;

  const SortButton = ({ id, label, hint }) => {
    const active = sortMode === id;
    return (
      <button
        type="button"
        onClick={() => setSortMode(id)}
        title={hint}
        className={[
          "group relative inline-flex items-center justify-center rounded-xl border px-3 py-2 font-serif text-[11px] font-semibold uppercase tracking-wide transition",
          active
            ? "border-amber-400/70 bg-gradient-to-r from-amber-950/60 via-purple-950/50 to-slate-950 text-amber-200 shadow-lg shadow-amber-900/20 ring-1 ring-amber-400/30"
            : "border-amber-900/40 bg-slate-950/40 text-amber-100/80 hover:border-amber-500/60 hover:text-amber-100",
        ].join(" ")}
      >
        {label}
        <span
          className={[
            "pointer-events-none absolute inset-x-0 -bottom-px mx-auto h-px w-0 bg-gradient-to-r from-transparent via-amber-400 to-transparent transition-all",
            active ? "w-10 opacity-100" : "group-hover:w-10 group-hover:opacity-80",
          ].join(" ")}
        />
      </button>
    );
  };

  return (
    <div className="relative flex flex-col gap-6 md:flex-row">
      {/* glows */}
      <div className="pointer-events-none absolute -left-32 top-10 h-64 w-64 rounded-full bg-purple-900/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 bottom-0 h-72 w-72 rounded-full bg-amber-800/25 blur-3xl" />

      {/* LEFT */}
      <section className="relative z-10 flex-1 space-y-6">
        {/* Role banner */}
        <div className="overflow-hidden rounded-2xl border border-amber-900/40 bg-gradient-to-br from-slate-950 via-purple-950/45 to-slate-950 p-4 shadow-lg shadow-purple-900/20">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-serif text-xs text-amber-100/70">
                Logged in as{" "}
                <span className="font-semibold text-amber-200">{currentUser?.name}</span>
              </p>
              <p className="font-serif text-[11px] uppercase tracking-[0.25em] text-amber-500">
                ROLE: {currentUser?.role}
              </p>
            </div>

            <span className="rounded-full border border-sky-600/40 bg-sky-950/30 px-3 py-1 font-serif text-[10px] uppercase tracking-wide text-sky-200">
              User Mode: Buy Only
            </span>
          </div>
        </div>

        {/* Errors */}
        {serverError ? (
          <div className="rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200">
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

        {/* Controls bar */}
        <div className="rounded-2xl border border-amber-900/40 bg-gradient-to-br from-slate-950 to-purple-950/30 p-4 shadow-lg shadow-purple-900/20">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <h3 className="font-serif text-xl font-bold text-amber-100">
                {activeTcg?.name} Marketplace
              </h3>
              <p className="mt-1 font-serif text-[11px] italic text-amber-200/70">
                Live vendor inventory • Search • Filter • Sort
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name / code / category..."
                  className="w-full md:w-72 rounded-xl border border-amber-900/40 bg-slate-950/60 px-3 py-2 font-serif text-[12px] text-amber-50 placeholder:text-amber-200/30 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-amber-200/40">
                  ⌕
                </div>
              </div>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-xl border border-amber-900/40 bg-slate-950/60 px-3 py-2 font-serif text-[12px] text-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                title="Filter by category"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c === "ALL" ? "All Categories" : c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <SortButton id="NEWEST" label="Newest" hint="Sort by created date (latest first)" />
            <SortButton id="AZ" label="A–Z" hint="Sort by name A–Z" />
            <SortButton id="PRICE_ASC" label="Price ↑" hint="Lowest price first" />
            <SortButton id="PRICE_DESC" label="Price ↓" hint="Highest price first" />
            <SortButton id="CAT_AZ" label="Category A–Z" hint="Sort by category A–Z" />
            <SortButton id="CAT_ZA" label="Category Z–A" hint="Sort by category Z–A" />

            <span className="ml-auto font-serif text-[11px] italic text-amber-500">
              {loadingProducts ? "Loading..." : `${filteredProducts.length} item(s)`}
            </span>
          </div>
        </div>

        {/* Products grid */}
        {loadingProducts ? (
          <div className="rounded-xl border border-amber-900/40 bg-slate-950/50 p-6 font-serif text-sm italic text-amber-100/70">
            Loading inventory...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="rounded-xl border border-amber-900/40 bg-gradient-to-br from-slate-950 to-purple-950/40 p-6 text-sm italic text-amber-100/70">
            No products found (try changing category / search / tcg).
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((p) => (
              <article
                key={p.id}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-amber-900/40 bg-gradient-to-br from-slate-950 to-purple-950/40 shadow-lg shadow-purple-900/30 transition-all duration-200 hover:-translate-y-2 hover:border-amber-500/60 hover:shadow-2xl hover:shadow-amber-900/30"
              >
                <div className="relative h-44 w-full overflow-hidden">
                  <img
                    src={p.image}
                    alt={p.name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                    onError={(e) => (e.currentTarget.src = PLACEHOLDER)}
                  />
                  <div className="absolute left-2 top-2 rounded-full border border-amber-500/40 bg-slate-950/70 px-3 py-1 font-serif text-[10px] uppercase tracking-wide text-amber-200">
                    {p.category || "Uncategorized"}
                  </div>

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
                      <span className="font-semibold text-amber-300">{toInt(p.stock)}</span>
                    </span>
                    <span className="rounded-full border border-purple-700/40 bg-purple-950/30 px-2 py-0.5 font-serif text-[10px] uppercase tracking-wide text-purple-200">
                      {p.code || "—"}
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

      {/* RIGHT cart (same style as your previous design) */}
      <aside className="relative z-10 mt-6 w-full max-w-sm md:mt-0 md:w-80">
        <div className="sticky top-20 overflow-hidden rounded-2xl border border-amber-900/50 bg-gradient-to-br from-slate-950 via-purple-950/45 to-slate-950 p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="font-serif text-base font-bold text-amber-50">Arcane Cart</h3>
              <p className="font-serif text-[11px] italic text-amber-200/70">
                Review relics before sealing the deal.
              </p>
            </div>
            <span className="rounded-full border border-amber-700/50 bg-amber-950/50 px-3 py-1 font-serif text-[10px] uppercase tracking-wide text-amber-200">
              {cartTotalItems} item{cartTotalItems !== 1 ? "s" : ""}
            </span>
          </div>

          {cart.length === 0 ? (
            <p className="font-serif text-xs italic text-amber-100/65">Your cart is empty.</p>
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
                          onChange={(e) => updateQuantity(item.id, Number(e.target.value))}
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
