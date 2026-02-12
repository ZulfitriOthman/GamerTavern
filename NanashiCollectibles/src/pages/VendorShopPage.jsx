// src/pages/VendorShopPage.jsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { TCG_LIST, PRODUCTS } from "../data/products";

const ROLES = {
  USER: "USER",
  VENDOR: "VENDOR",
  ADMIN: "ADMIN",
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

  // ✅ Guard: must be logged in AND vendor/admin
  useEffect(() => {
    const raw = localStorage.getItem("tavern_current_user");
    const user = raw ? JSON.parse(raw) : null;

    if (!user?.id) {
      navigate("/login");
      return;
    }

    const role = String(user?.role || ROLES.USER).toUpperCase();
    user.role = Object.values(ROLES).includes(role) ? role : ROLES.USER;

    if (!(user.role === ROLES.VENDOR || user.role === ROLES.ADMIN)) {
      navigate("/user/shop");
      return;
    }

    setCurrentUser(user);
  }, [navigate]);

  const isVendor = currentUser?.role === ROLES.VENDOR || currentUser?.role === ROLES.ADMIN;

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

  const filteredProducts = useMemo(
    () => PRODUCTS.filter((p) => p.tcg === selectedTcg),
    [selectedTcg],
  );

  const handleSelectTcg = (id) => {
    setSelectedTcg(id);
    navigate(`/vendor/tcg/${id}`);
  };

  const handleVendorAddProduct = () => {
    alert("Vendor: Add Product (connect to DB later)");
  };

  const handleVendorManageInventory = () => {
    alert("Vendor: Manage Inventory (create a dashboard route)");
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

        {/* Vendor console */}
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
                className="rounded-xl border border-emerald-500/50 bg-gradient-to-r from-emerald-950/40 to-slate-950 px-4 py-3 text-left font-serif text-xs font-semibold text-emerald-100 transition hover:border-emerald-400"
              >
                + Add Product
                <div className="mt-1 text-[10px] font-normal text-emerald-100/60">
                  Create a new listing
                </div>
              </button>

              <button
                type="button"
                onClick={handleVendorManageInventory}
                className="rounded-xl border border-emerald-500/50 bg-gradient-to-r from-emerald-950/40 to-slate-950 px-4 py-3 text-left font-serif text-xs font-semibold text-emerald-100 transition hover:border-emerald-400"
              >
                Manage Inventory
                <div className="mt-1 text-[10px] font-normal text-emerald-100/60">
                  Stock & pricing tools
                </div>
              </button>
            </div>
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
                Vendor view: Buy + Sell tools enabled.
              </p>
            </div>
            <p className="font-serif text-xs italic text-amber-500">
              {filteredProducts.length} item{filteredProducts.length !== 1 ? "s" : ""} available
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((p) => (
              <article
                key={p.id}
                className="group relative flex flex-col overflow-hidden rounded-xl border border-amber-900/40 bg-gradient-to-br from-slate-950 to-purple-950/40 shadow-lg shadow-purple-900/30"
              >
                <div className="relative h-40 w-full overflow-hidden">
                  <img
                    src={p.image}
                    alt={p.name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute bottom-2 right-2 rounded-full border border-emerald-500/60 bg-slate-950/80 px-3 py-1 font-serif text-[11px] font-semibold text-emerald-300">
                    BND {p.price.toFixed(2)}
                  </div>
                </div>

                <div className="flex flex-1 flex-col gap-2 p-4">
                  <h4 className="line-clamp-2 font-serif text-sm font-semibold text-amber-50">
                    {p.name}
                  </h4>

                  {/* BUY */}
                  <button
                    onClick={() => addToCart(p)}
                    disabled={p.stock === 0}
                    className="mt-2 inline-flex items-center justify-center rounded-lg border border-amber-500/60 bg-gradient-to-r from-amber-950/60 to-purple-950/60 px-3 py-2 font-serif text-[11px] font-semibold uppercase tracking-wide text-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {p.stock === 0 ? "Out of Stock" : "Add to Cart"}
                  </button>

                  {/* SELL */}
                  <button
                    type="button"
                    onClick={() => alert(`Sell / list flow for: ${p.name}`)}
                    className="inline-flex items-center justify-center rounded-lg border border-emerald-500/50 bg-gradient-to-r from-emerald-950/40 to-slate-950 px-3 py-2 font-serif text-[11px] font-semibold uppercase tracking-wide text-emerald-100 hover:border-emerald-400"
                  >
                    Sell / List Item
                  </button>
                </div>
              </article>
            ))}
          </div>
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

                <p className="mt-2 font-serif text-[10px] italic text-emerald-200/60">
                  Vendor tip: use Vendor Console to list items for sale.
                </p>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
