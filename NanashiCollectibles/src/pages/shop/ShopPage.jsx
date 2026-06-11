// src/pages/ShopPage.jsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { TCG_LIST, PRODUCTS } from "../../data/products";
import { getCurrentUser } from "../../authStorage";

const ROLES = {
  USER: "USER",
  VENDOR: "VENDOR",
  ADMIN: "ADMIN",
};

function ShopPage({
  cart,
  addToCart,
  removeFromCart,
  updateQuantity,
  cartTotalItems,
  cartTotalPrice,
}) {
  const { tcgId } = useParams();
  const navigate = useNavigate();

  // ✅ Auth (role-based view)
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const user = getCurrentUser();

    if (!user?.id) {
      navigate("/login");
      return;
    }

    // normalize role
    const role = String(user?.role || ROLES.USER).toUpperCase();
    user.role = Object.values(ROLES).includes(role) ? role : ROLES.USER;

    setCurrentUser(user);
  }, [navigate]);

  const isVendor = currentUser?.role === ROLES.VENDOR || currentUser?.role === ROLES.ADMIN;
  const isUser = currentUser?.role === ROLES.USER;

  // Selected TCG – driven by URL if present
  const [selectedTcg, setSelectedTcg] = useState(() => {
    if (tcgId && TCG_LIST.some((t) => t.id === tcgId)) return tcgId;
    return "mtg";
  });

  // Whenever URL param changes, sync selectedTcg
  useEffect(() => {
    if (!tcgId) return;
    if (TCG_LIST.some((t) => t.id === tcgId)) {
      setSelectedTcg(tcgId);
    }
  }, [tcgId]);

  const activeTcg = useMemo(
    () => TCG_LIST.find((t) => t.id === selectedTcg),
    [selectedTcg],
  );

  const filteredProducts = useMemo(
    () => PRODUCTS.filter((p) => p.tcg === selectedTcg),
    [selectedTcg],
  );

  const handleSelectTcg = (id) => {
    setSelectedTcg(id);
    navigate(`/tcg/${id}`);
  };

  // ✅ Vendor placeholder actions
  const handleVendorAddProduct = () => {
    alert("Vendor action: Add Product (hook this to your DB later)");
  };

  const handleVendorManageInventory = () => {
    alert("Vendor action: Manage Inventory (create vendor dashboard route)");
  };

  // ✅ Prevent rendering flicker before user loads
  if (!currentUser) return null;

  return (
    <div className="relative flex flex-col gap-6 md:flex-row">
      {/* Soft magical background glows */}
      <div className="pointer-events-none absolute -left-32 top-10 h-64 w-64 rounded-full bg-purple-900/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 bottom-0 h-72 w-72 rounded-full bg-amber-800/25 blur-3xl" />

      {/* LEFT: TCG Selector + Product list */}
      <section className="relative z-10 flex-1 space-y-6">
        {/* ✅ Role Banner */}
        <div className="overflow-hidden rounded-2xl border border-amber-900/40 bg-gradient-to-br from-slate-950 via-purple-950/45 to-slate-950 p-4 shadow-lg shadow-purple-900/20">
          <div className="flex flex-wrap items-center justify-between gap-2">
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
              {isVendor ? (
                <span className="rounded-full border border-emerald-600/40 bg-emerald-950/30 px-3 py-1 font-serif text-[10px] uppercase tracking-wide text-emerald-200">
                  Vendor Mode: Buy + Sell
                </span>
              ) : (
                <span className="rounded-full border border-sky-600/40 bg-sky-950/30 px-3 py-1 font-serif text-[10px] uppercase tracking-wide text-sky-200">
                  User Mode: Buy Only
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Intro - Fantasy Style */}
        <div className="relative overflow-hidden rounded-2xl border border-amber-900/40 bg-gradient-to-br from-slate-950 via-purple-950/50 to-slate-950 p-6 md:p-8 shadow-[0_0_40px_rgba(15,23,42,0.9)] ring-1 ring-purple-900/30">
          {/* Decorative corners */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-3 top-3 h-6 w-6 rounded-full border border-amber-500/30" />
            <div className="absolute right-3 top-3 h-6 w-6 rounded-full border border-amber-500/30" />
            <div className="absolute bottom-3 left-3 h-6 w-6 rounded-full border border-purple-500/30" />
            <div className="absolute bottom-3 right-3 h-6 w-6 rounded-full border border-purple-500/30" />
          </div>

          <div className="absolute inset-x-6 top-3 h-px bg-gradient-to-r from-transparent via-amber-500/70 to-transparent opacity-70" />

          <p className="mb-2 font-serif text-[11px] uppercase tracking-[0.35em] text-amber-500">
            Arcane Selection
          </p>
          <h2 className="font-serif text-3xl font-bold text-amber-100 md:text-4xl">
            Pick your game. Forge your deck.
          </h2>

          <p className="mt-3 max-w-xl text-sm italic text-amber-100/75">
            {isVendor
              ? "Vendor access enabled — you can buy products and also list items for sale."
              : "User access enabled — browse products and purchase items."}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-amber-700/40 bg-amber-950/40 px-3 py-1 font-serif text-[10px] uppercase tracking-wide text-amber-200">
              Singles & Boosters
            </span>
            <span className="rounded-full border border-purple-700/40 bg-purple-950/40 px-3 py-1 font-serif text-[10px] uppercase tracking-wide text-purple-100">
              Multi-TCG Support
            </span>
            {isVendor ? (
              <span className="rounded-full border border-emerald-700/40 bg-emerald-950/30 px-3 py-1 font-serif text-[10px] uppercase tracking-wide text-emerald-100">
                Vendor Console
              </span>
            ) : null}
          </div>

          <div className="absolute inset-x-6 bottom-3 h-px bg-gradient-to-r from-transparent via-amber-500/70 to-transparent opacity-70" />
        </div>

        {/* ✅ Vendor-only panel */}
        {isVendor ? (
          <div className="rounded-2xl border border-emerald-900/40 bg-gradient-to-br from-slate-950 to-emerald-950/20 p-5 shadow-lg shadow-emerald-900/20">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-serif text-base font-bold text-emerald-100">
                  Vendor Console
                </h3>
                <p className="mt-1 font-serif text-[11px] italic text-emerald-100/70">
                  Sell items, manage stock, and track your listings.
                </p>
              </div>

              <span className="rounded-full border border-emerald-600/40 bg-emerald-950/30 px-3 py-1 font-serif text-[10px] uppercase tracking-wide text-emerald-200">
                SELL ENABLED
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleVendorAddProduct}
                className="rounded-xl border border-emerald-500/50 bg-gradient-to-r from-emerald-950/40 to-slate-950 px-4 py-3 text-left font-serif text-xs font-semibold text-emerald-100 shadow-md shadow-emerald-900/20 transition hover:border-emerald-400"
              >
                + Add Product
                <div className="mt-1 text-[10px] font-normal text-emerald-100/60">
                  Create a new listing
                </div>
              </button>

              <button
                type="button"
                onClick={handleVendorManageInventory}
                className="rounded-xl border border-emerald-500/50 bg-gradient-to-r from-emerald-950/40 to-slate-950 px-4 py-3 text-left font-serif text-xs font-semibold text-emerald-100 shadow-md shadow-emerald-900/20 transition hover:border-emerald-400"
              >
                Manage Inventory
                <div className="mt-1 text-[10px] font-normal text-emerald-100/60">
                  Stock & pricing tools
                </div>
              </button>
            </div>
          </div>
        ) : null}

        {/* TCG Selector - Clean Dropdown */}
        <div className="rounded-2xl border border-amber-900/40 bg-gradient-to-br from-slate-950 via-purple-950/45 to-slate-950 p-5 shadow-lg shadow-purple-900/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            {/* Left Info */}
            <div>
              <p className="font-serif text-[10px] font-bold uppercase tracking-[0.28em] text-amber-500">
                Trading Card Game
              </p>

              <h3 className="mt-1 font-serif text-xl font-bold text-amber-100">
                {activeTcg?.name || "Choose Category"}
              </h3>

              <p className="mt-1 font-serif text-xs italic text-amber-100/60">
                Select a category to browse listings, prices, and available stock.
              </p>
            </div>

            {/* Right Dropdown */}
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:w-auto">
              <div className="relative w-full lg:w-[340px]">
                <select
                  value={selectedTcg}
                  onChange={(e) => handleSelectTcg(e.target.value)}
                  className="
                    h-12 w-full appearance-none rounded-xl border border-amber-700/50
                    bg-slate-950 px-4 pr-10 font-serif text-sm font-semibold text-amber-100
                    shadow-inner shadow-purple-950/50 outline-none transition
                    hover:border-amber-500/70
                    focus:border-amber-400 focus:ring-2 focus:ring-amber-500/30
                  "
                >
                  {TCG_LIST.map((tcg) => (
                    <option
                      key={tcg.id}
                      value={tcg.id}
                      className="bg-slate-950 text-amber-100"
                    >
                      {tcg.name}
                    </option>
                  ))}
                </select>

                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-amber-300">
                  ▼
                </span>
              </div>

              <button
                type="button"
                onClick={() => handleSelectTcg(selectedTcg)}
                className="
                  h-12 rounded-xl border border-amber-500/60
                  bg-gradient-to-r from-amber-950/70 via-purple-950/70 to-slate-950
                  px-6 font-serif text-xs font-bold uppercase tracking-[0.18em]
                  text-amber-100 shadow-md shadow-amber-900/30 transition
                  hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-amber-500/30
                "
              >
                Browse
              </button>
            </div>
          </div>

          {/* Selected category indicator */}
          <div className="mt-4 rounded-xl border border-amber-900/40 bg-black/25 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-serif text-[10px] uppercase tracking-[0.22em] text-amber-500/80">
                  Current Selection
                </p>
                <p className="mt-1 font-serif text-sm font-bold text-amber-50">
                  {activeTcg?.name}
                </p>
              </div>

              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-amber-500/50 bg-slate-950/80 text-xs font-bold text-amber-200">
                {activeTcg?.name?.[0] || "?"}
              </div>
            </div>

            <div
              className={[
                "mt-3 h-1 rounded-full bg-gradient-to-r",
                activeTcg?.color || "from-purple-500 to-indigo-500",
              ].join(" ")}
            />
          </div>
        </div>

        {/* Product list */}
        <div className="mt-2">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="font-serif text-xl font-bold text-amber-100">
                {activeTcg?.name} Products
              </h3>
              <p className="font-serif text-[11px] italic text-amber-200/70">
                Browse inventory aligned to your chosen realm.
              </p>
            </div>
            <p className="font-serif text-xs italic text-amber-500">
              {filteredProducts.length} item
              {filteredProducts.length !== 1 ? "s" : ""} available
            </p>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="rounded-xl border border-amber-900/40 bg-gradient-to-br from-slate-950 to-purple-950/40 p-6 text-sm italic text-amber-100/70 shadow-inner shadow-purple-900/20">
              No products yet for this TCG. The vault is still being stocked —
              check back soon.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredProducts.map((p) => (
                <article
                  key={p.id}
                  className="group relative flex flex-col overflow-hidden rounded-xl border border-amber-900/40 bg-gradient-to-br from-slate-950 to-purple-950/40 shadow-lg shadow-purple-900/30 transition-all duration-200 hover:-translate-y-2 hover:border-amber-500/60 hover:shadow-2xl hover:shadow-amber-900/40"
                >
                  <div className="absolute inset-x-4 top-2 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

                  <div className="relative h-40 w-full overflow-hidden">
                    <img
                      src={p.image}
                      alt={p.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-purple-950/70 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                    <span className="absolute left-2 top-2 rounded-full border border-amber-500/50 bg-black/70 px-2 py-0.5 font-serif text-[10px] uppercase tracking-[0.2em] text-amber-100 backdrop-blur-sm">
                      {p.rarity}
                    </span>

                    <div className="absolute bottom-2 right-2 rounded-full border border-emerald-500/60 bg-slate-950/80 px-3 py-1 font-serif text-[11px] font-semibold text-emerald-300 shadow-lg shadow-emerald-900/50">
                      BND {p.price.toFixed(2)}
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
                          {p.stock}
                        </span>
                      </span>
                      <span className="rounded-full border border-amber-700/40 bg-amber-950/40 px-2 py-0.5 font-serif text-[10px] uppercase tracking-wide text-amber-200">
                        {selectedTcg?.toUpperCase()}
                      </span>
                    </div>

                    {/* ✅ BUY is available to USER and VENDOR */}
                    <button
                      onClick={() => addToCart(p)}
                      className="mt-2 inline-flex items-center justify-center rounded-lg border border-amber-500/60 bg-gradient-to-r from-amber-950/60 to-purple-950/60 px-3 py-2 font-serif text-[11px] font-semibold uppercase tracking-wide text-amber-100 shadow-md shadow-amber-900/40 transition-all hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-lg hover:shadow-amber-500/50 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-900 disabled:text-slate-500 disabled:shadow-none"
                      disabled={p.stock === 0}
                    >
                      {p.stock === 0 ? "Out of Stock" : "Add to Cart"}
                    </button>

                    {/* ✅ VENDOR-only "Sell" action (placeholder) */}
                    {isVendor ? (
                      <button
                        type="button"
                        onClick={() => alert(`Sell flow for: ${p.name}`)}
                        className="inline-flex items-center justify-center rounded-lg border border-emerald-500/50 bg-gradient-to-r from-emerald-950/40 to-slate-950 px-3 py-2 font-serif text-[11px] font-semibold uppercase tracking-wide text-emerald-100 shadow-md shadow-emerald-900/20 transition-all hover:border-emerald-400"
                      >
                        Sell / List Item
                      </button>
                    ) : null}
                  </div>

                  <div className="absolute inset-x-4 bottom-2 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* RIGHT: Cart summary (sidebar) */}
      <aside className="relative z-10 mt-6 w-full max-w-sm md:mt-0 md:w-80">
        <div className="sticky top-20 overflow-hidden rounded-2xl border border-amber-900/50 bg-gradient-to-br from-slate-950 via-purple-950/45 to-slate-950 p-5 shadow-[0_0_40px_rgba(15,23,42,0.9)] ring-1 ring-purple-900/40">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-x-5 top-3 h-px bg-gradient-to-r from-transparent via-amber-400/70 to-transparent" />
            <div className="absolute inset-x-5 bottom-3 h-px bg-gradient-to-r from-transparent via-amber-400/70 to-transparent" />
          </div>

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
              Your cart is empty. Add boosters, singles, or treasures from the
              vault to begin your journey.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-2 rounded-xl border border-amber-900/40 bg-gradient-to-br from-slate-950 to-purple-950/40 p-3 shadow-md shadow-slate-900/60"
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
                          className="w-14 rounded-md border border-amber-900/50 bg-slate-950 px-2 py-1 font-serif text-[11px] text-amber-50 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="font-serif text-[11px] text-rose-400 transition-colors hover:text-rose-300"
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

              <div className="relative mt-4 border-t border-amber-900/50 pt-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-serif text-amber-100/75">
                    Total Tribute
                  </span>
                  <span className="font-serif text-lg font-bold text-amber-300">
                    BND {cartTotalPrice.toFixed(2)}
                  </span>
                </div>
                <Link
                  to="/cart"
                  className="mt-4 block w-full overflow-hidden rounded-lg border border-amber-500/70 bg-gradient-to-r from-amber-950/70 via-purple-950/70 to-slate-950 py-2.5 text-center font-serif text-[11px] font-bold uppercase tracking-[0.2em] text-amber-50 shadow-lg shadow-amber-900/50 transition-all hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-amber-500/70"
                >
                  Go to Checkout
                </Link>

                {/* ✅ Optional helper copy for vendors */}
                {isVendor ? (
                  <p className="mt-2 font-serif text-[10px] italic text-emerald-200/60">
                    Vendor tip: use the Vendor Console above to list items for sale.
                  </p>
                ) : (
                  <p className="mt-2 font-serif text-[10px] italic text-amber-100/45">
                    Browse, add to cart, and checkout.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

export default ShopPage;
