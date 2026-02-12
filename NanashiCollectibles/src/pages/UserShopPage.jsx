// src/pages/UserShopPage.jsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { TCG_LIST, PRODUCTS } from "../data/products";

const ROLES = {
  USER: "USER",
  VENDOR: "VENDOR",
  ADMIN: "ADMIN",
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

  // ✅ Guard: must be logged in AND role USER
  useEffect(() => {
    const raw = localStorage.getItem("tavern_current_user");
    const user = raw ? JSON.parse(raw) : null;

    if (!user?.id) {
      navigate("/login");
      return;
    }

    const role = String(user?.role || ROLES.USER).toUpperCase();
    user.role = Object.values(ROLES).includes(role) ? role : ROLES.USER;

    // If vendor/admin tries to access user page, redirect to vendor page
    if (user.role === ROLES.VENDOR || user.role === ROLES.ADMIN) {
      navigate("/vendor/shop");
      return;
    }

    setCurrentUser(user);
  }, [navigate]);

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
    navigate(`/user/tcg/${id}`);
  };

  if (!currentUser) return null;

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
                <span className="font-semibold text-amber-200">
                  {currentUser?.name}
                </span>
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

        {/* Products */}
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
              {filteredProducts.length} item{filteredProducts.length !== 1 ? "s" : ""} available
            </p>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="rounded-xl border border-amber-900/40 bg-gradient-to-br from-slate-950 to-purple-950/40 p-6 text-sm italic text-amber-100/70">
              No products yet for this TCG.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredProducts.map((p) => (
                <article
                  key={p.id}
                  className="group relative flex flex-col overflow-hidden rounded-xl border border-amber-900/40 bg-gradient-to-br from-slate-950 to-purple-950/40 shadow-lg shadow-purple-900/30 transition-all duration-200 hover:-translate-y-2 hover:border-amber-500/60 hover:shadow-2xl hover:shadow-amber-900/40"
                >
                  <div className="relative h-40 w-full overflow-hidden">
                    <img
                      src={p.image}
                      alt={p.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <span className="absolute bottom-2 right-2 rounded-full border border-emerald-500/60 bg-slate-950/80 px-3 py-1 font-serif text-[11px] font-semibold text-emerald-300">
                      BND {p.price.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <h4 className="line-clamp-2 font-serif text-sm font-semibold text-amber-50">
                      {p.name}
                    </h4>

                    <button
                      onClick={() => addToCart(p)}
                      disabled={p.stock === 0}
                      className="mt-2 inline-flex items-center justify-center rounded-lg border border-amber-500/60 bg-gradient-to-r from-amber-950/60 to-purple-950/60 px-3 py-2 font-serif text-[11px] font-semibold uppercase tracking-wide text-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {p.stock === 0 ? "Out of Stock" : "Add to Cart"}
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
