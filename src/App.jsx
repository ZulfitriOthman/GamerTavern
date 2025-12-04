// src/App.jsx
import { useMemo, useState } from "react";
import { TCG_LIST, PRODUCTS } from "./data/products";

function App() {
  const [selectedTcg, setSelectedTcg] = useState("mtg");
  const [cart, setCart] = useState([]);

  /* ----------------- Derived lists ----------------- */
  const activeTcg = useMemo(
    () => TCG_LIST.find((t) => t.id === selectedTcg),
    [selectedTcg]
  );

  const filteredProducts = useMemo(
    () => PRODUCTS.filter((p) => p.tcg === selectedTcg),
    [selectedTcg]
  );

  const cartTotalItems = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  const cartTotalPrice = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity * item.price, 0),
    [cart]
  );

  /* ----------------- Cart logic ----------------- */
  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.id === product.id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (id) => {
    setCart((prev) => prev.filter((i) => i.id !== id));
  };

  const updateQuantity = (id, qty) => {
    setCart((prev) =>
      prev
        .map((i) =>
          i.id === id ? { ...i, quantity: Math.max(1, qty) } : i
        )
        .filter((i) => i.quantity > 0)
    );
  };

  /* ----------------- UI ----------------- */
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* NAVBAR */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-20">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500" />
            <div>
              <h1 className="text-lg font-semibold tracking-wide">
                Arcane TCG Market
              </h1>
              <p className="text-xs text-slate-400">
                Singles • Boosters • Accessories
              </p>
            </div>
          </div>

          <button className="relative rounded-full border border-slate-700 px-4 py-1 text-sm hover:border-purple-500 hover:text-purple-300">
            Cart ({cartTotalItems})
          </button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:flex-row">
        {/* LEFT: TCG Selector + Product list */}
        <section className="flex-1 space-y-6">
          {/* Intro */}
          <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-4 md:p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400 mb-2">
              Choose your game
            </p>
            <h2 className="text-2xl font-bold md:text-3xl">
              Pick a TCG and start building your deck.
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Filter products by Trading Card Game. Later we can add sets,
              rarities, and advanced search.
            </p>
          </div>

          {/* TCG Selector */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {TCG_LIST.map((tcg) => {
              const isActive = tcg.id === selectedTcg;
              return (
                <button
                  key={tcg.id}
                  onClick={() => setSelectedTcg(tcg.id)}
                  className={[
                    "group relative flex h-24 flex-col justify-between rounded-xl border p-3 text-left transition",
                    isActive
                      ? "border-purple-400/80 bg-slate-900/80 shadow-lg shadow-purple-500/20"
                      : "border-slate-800 bg-slate-900/40 hover:border-purple-500/50 hover:bg-slate-900",
                  ].join(" ")}
                >
                  <span className="text-xs uppercase tracking-wide text-slate-400">
                    TCG
                  </span>
                  <span className="text-sm font-semibold leading-snug">
                    {tcg.name}
                  </span>
                  <div
                    className={[
                      "pointer-events-none absolute inset-x-0 bottom-0 h-1 rounded-b-xl bg-gradient-to-r opacity-70",
                      tcg.color,
                    ].join(" ")}
                  />
                </button>
              );
            })}
          </div>

          {/* Product list for selected TCG */}
          <div className="mt-2">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {activeTcg?.name} Products
              </h3>
              <p className="text-xs text-slate-400">
                {filteredProducts.length} item
                {filteredProducts.length !== 1 ? "s" : ""} available
              </p>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-400">
                No products yet for this TCG. We&apos;ll add inventory later.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredProducts.map((p) => (
                  <article
                    key={p.id}
                    className="group flex flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/70 shadow-sm shadow-slate-900/50 transition hover:-translate-y-1 hover:border-purple-500/70 hover:shadow-purple-500/20"
                  >
                    {/* Image */}
                    <div className="relative h-40 w-full overflow-hidden">
                      <img
                        src={p.image}
                        alt={p.name}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-200">
                        {p.rarity}
                      </span>
                    </div>

                    {/* Body */}
                    <div className="flex flex-1 flex-col gap-2 p-3">
                      <h4 className="line-clamp-2 text-sm font-semibold">
                        {p.name}
                      </h4>
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>Stock: {p.stock}</span>
                        <span className="font-semibold text-emerald-300">
                          BND {p.price.toFixed(2)}
                        </span>
                      </div>

                      <button
                        onClick={() => addToCart(p)}
                        className="mt-2 inline-flex items-center justify-center rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:bg-slate-700"
                        disabled={p.stock === 0}
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

        {/* RIGHT: Cart summary */}
        <aside className="mt-6 w-full max-w-sm md:mt-0 md:w-80">
          <div className="sticky top-20 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <h3 className="mb-2 flex items-center justify-between text-sm font-semibold">
              <span>Your Cart</span>
              <span className="text-xs text-slate-400">
                {cartTotalItems} item{cartTotalItems !== 1 ? "s" : ""}
              </span>
            </h3>

            {cart.length === 0 ? (
              <p className="text-xs text-slate-500">
                Your cart is empty. Add some boosters or singles to begin.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/50 p-2"
                    >
                      <div className="flex flex-1 flex-col">
                        <span className="text-xs font-semibold">
                          {item.name}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          BND {item.price.toFixed(2)} each
                        </span>
                        <div className="mt-1 flex items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) =>
                              updateQuantity(item.id, Number(e.target.value))
                            }
                            className="w-14 rounded-md border border-slate-700 bg-slate-900 px-1 py-0.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-purple-500"
                          />
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="text-[11px] text-rose-400 hover:text-rose-300"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-emerald-300">
                        BND {(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-3 border-t border-slate-800 pt-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Total</span>
                    <span className="font-semibold text-emerald-300">
                      BND {cartTotalPrice.toFixed(2)}
                    </span>
                  </div>
                  <button
                    className="mt-3 w-full rounded-lg bg-emerald-600 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-emerald-500"
                    onClick={() => alert("Checkout flow coming soon 😉")}
                  >
                    Proceed to Checkout
                  </button>
                  <p className="mt-1 text-[10px] text-slate-500">
                    Later we can connect this to Stripe / local gateway and
                    save orders in Oracle.
                  </p>
                </div>
              </div>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}

export default App;
