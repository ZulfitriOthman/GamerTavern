// src/pages/ShopPage.jsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { TCG_LIST, PRODUCTS } from "../data/products";

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
    [selectedTcg]
  );

  const filteredProducts = useMemo(
    () => PRODUCTS.filter((p) => p.tcg === selectedTcg),
    [selectedTcg]
  );

  const handleSelectTcg = (id) => {
    setSelectedTcg(id);
    navigate(`/tcg/${id}`);
  };

  return (
    <div className="relative flex flex-col gap-6 md:flex-row">
      {/* Soft magical background glows */}
      <div className="pointer-events-none absolute -left-32 top-10 h-64 w-64 rounded-full bg-purple-900/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 bottom-0 h-72 w-72 rounded-full bg-amber-800/25 blur-3xl" />

      {/* LEFT: TCG Selector + Product list */}
      <section className="relative z-10 flex-1 space-y-6">
        {/* Intro - Fantasy Style */}
        <div className="relative overflow-hidden rounded-2xl border border-amber-900/40 bg-gradient-to-br from-slate-950 via-purple-950/50 to-slate-950 p-6 md:p-8 shadow-[0_0_40px_rgba(15,23,42,0.9)] ring-1 ring-purple-900/30">
          {/* Decorative corners */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-3 top-3 h-6 w-6 rounded-full border border-amber-500/30" />
            <div className="absolute right-3 top-3 h-6 w-6 rounded-full border border-amber-500/30" />
            <div className="absolute bottom-3 left-3 h-6 w-6 rounded-full border border-purple-500/30" />
            <div className="absolute bottom-3 right-3 h-6 w-6 rounded-full border border-purple-500/30" />
          </div>

          {/* Ornate top border */}
          <div className="absolute inset-x-6 top-3 h-px bg-gradient-to-r from-transparent via-amber-500/70 to-transparent opacity-70" />

          <p className="mb-2 font-serif text-[11px] uppercase tracking-[0.35em] text-amber-500">
            Arcane Selection
          </p>
          <h2 className="font-serif text-3xl font-bold text-amber-100 md:text-4xl">
            Pick your game. Forge your deck.
          </h2>
          <p className="mt-3 max-w-xl text-sm italic text-amber-100/75">
            Choose a Trading Card Game to browse curated products. Boosters,
            singles, and more will appear as your collection grows.
          </p>

          {/* Tagline chips */}
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-amber-700/40 bg-amber-950/40 px-3 py-1 font-serif text-[10px] uppercase tracking-wide text-amber-200">
              Singles & Boosters
            </span>
            <span className="rounded-full border border-purple-700/40 bg-purple-950/40 px-3 py-1 font-serif text-[10px] uppercase tracking-wide text-purple-100">
              Multi-TCG Support
            </span>
            <span className="rounded-full border border-emerald-700/40 bg-emerald-950/30 px-3 py-1 font-serif text-[10px] uppercase tracking-wide text-emerald-100">
              Local Store Ready
            </span>
          </div>

          {/* Ornate bottom border */}
          <div className="absolute inset-x-6 bottom-3 h-px bg-gradient-to-r from-transparent via-amber-500/70 to-transparent opacity-70" />
        </div>

        {/* TCG Selector - Fantasy Style */}
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
                {/* Glow sweep */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.15),_transparent_55%)] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

                <div className="relative flex items-center justify-between gap-3">
                  <span className="font-serif text-[10px] uppercase tracking-[0.18em] text-amber-500">
                    Trading Card Game
                  </span>

                  {/* Icon orb */}
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-amber-500/50 bg-slate-950/80 text-xs font-bold text-amber-200 shadow-inner shadow-amber-900/60">
                    {initial}
                  </div>
                </div>

                <span className="relative mt-1 font-serif text-sm font-semibold leading-snug text-amber-50">
                  {tcg.name}
                </span>

                {/* Bottom accent line */}
                <div
                  className={[
                    "pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r opacity-70",
                    tcg.color,
                  ].join(" ")}
                />
                {isActive && (
                  <div className="pointer-events-none absolute inset-x-4 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-400 to-transparent" />
                )}
              </button>
            );
          })}
        </div>

        {/* Product list for selected TCG */}
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
                  {/* Ornate top border */}
                  <div className="absolute inset-x-4 top-2 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

                  {/* Image */}
                  <div className="relative h-40 w-full overflow-hidden">
                    <img
                      src={p.image}
                      alt={p.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    {/* Mystical overlay on hover */}
                    <div className="absolute inset-0 bg-gradient-to-t from-purple-950/70 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                    <span className="absolute left-2 top-2 rounded-full border border-amber-500/50 bg-black/70 px-2 py-0.5 font-serif text-[10px] uppercase tracking-[0.2em] text-amber-100 backdrop-blur-sm">
                      {p.rarity}
                    </span>

                    {/* Price badge floating on image */}
                    <div className="absolute bottom-2 right-2 rounded-full border border-emerald-500/60 bg-slate-950/80 px-3 py-1 font-serif text-[11px] font-semibold text-emerald-300 shadow-lg shadow-emerald-900/50">
                      BND {p.price.toFixed(2)}
                    </div>
                  </div>

                  {/* Body */}
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

                    <button
                      onClick={() => addToCart(p)}
                      className="mt-2 inline-flex items-center justify-center rounded-lg border border-amber-500/60 bg-gradient-to-r from-amber-950/60 to-purple-950/60 px-3 py-2 font-serif text-[11px] font-semibold uppercase tracking-wide text-amber-100 shadow-md shadow-amber-900/40 transition-all hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-lg hover:shadow-amber-500/50 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-900 disabled:text-slate-500 disabled:shadow-none"
                      disabled={p.stock === 0}
                    >
                      {p.stock === 0 ? "Out of Stock" : "Add to Cart"}
                    </button>
                  </div>

                  {/* Ornate bottom border */}
                  <div className="absolute inset-x-4 bottom-2 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* RIGHT: Cart summary (sidebar) - Fantasy Style */}
      <aside className="relative z-10 mt-6 w-full max-w-sm md:mt-0 md:w-80">
        <div className="sticky top-20 overflow-hidden rounded-2xl border border-amber-900/50 bg-gradient-to-br from-slate-950 via-purple-950/45 to-slate-950 p-5 shadow-[0_0_40px_rgba(15,23,42,0.9)] ring-1 ring-purple-900/40">
          {/* Ornate border lines */}
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
                <p className="mt-2 font-serif text-[10px] italic text-amber-100/45">
                  Future upgrade: connect to Stripe or a local gateway, and
                  record orders in Oracle — same pattern as your B-JAUR
                  ecosystem.
                </p>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

export default ShopPage;
