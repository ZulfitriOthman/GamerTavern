import { useMemo, useState } from "react";
import { Routes, Route, Link } from "react-router-dom";

import ShopPage from "./pages/ShopPage";
import CartPage from "./pages/CartPage";
import TradePage from "./pages/TradePage";
import NewsPage from "./pages/NewsPage";

function App() {
  const [cart, setCart] = useState([]);

  const cartTotalItems = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  const cartTotalPrice = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity * item.price, 0),
    [cart]
  );

  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
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
        .map((i) => (i.id === id ? { ...i, quantity: Math.max(1, qty) } : i))
        .filter((i) => i.quantity > 0)
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-purple-950/30 to-slate-950 text-amber-50">
      {/* Mystical particle background */}
      <div className="fixed inset-0 z-0 opacity-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(139,92,246,0.3),transparent_50%)]" />
      </div>

      {/* NAVBAR - Fantasy Style */}
      <header className="sticky top-0 z-50 border-b border-amber-900/30 bg-slate-950/95 backdrop-blur-xl shadow-2xl shadow-purple-900/20">
        <div className="relative">
          {/* Ornate top border */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
          
          <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-5">
            {/* Logo with mystical aura */}
            <Link to="/" className="group flex items-center gap-4">
              <div className="relative">
                <div className="absolute -inset-2 animate-pulse rounded-full bg-gradient-to-r from-amber-500/30 via-purple-500/30 to-amber-500/30 blur-xl" />
                <div className="relative h-14 w-14 rounded-full bg-gradient-to-br from-amber-500 via-purple-600 to-amber-600 p-0.5 shadow-2xl shadow-amber-500/50">
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-slate-900 to-purple-950">
                    <span className="text-2xl font-serif font-bold text-amber-400">⚔</span>
                  </div>
                </div>
              </div>
              <div>
                <h1 className="font-serif text-2xl font-bold tracking-wide text-amber-100">
                  Gamer Tavern
                </h1>
                <p className="font-serif text-xs italic tracking-wider text-amber-600">
                  Collector's Sanctum & Trading Post
                </p>
              </div>
            </Link>

            {/* Navigation with elegant styling */}
            <nav className="flex items-center gap-1">
              <Link
                to="/"
                className="group relative px-6 py-2.5 font-serif text-sm font-medium tracking-wide text-amber-100 transition-all hover:text-amber-300"
              >
                <span className="relative z-10">Shop</span>
                <div className="absolute inset-0 scale-x-0 rounded-lg bg-gradient-to-r from-amber-950/50 to-purple-950/50 transition-transform group-hover:scale-x-100" />
                <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
              <Link
                to="/trade"
                className="group relative px-6 py-2.5 font-serif text-sm font-medium tracking-wide text-amber-100 transition-all hover:text-amber-300"
              >
                <span className="relative z-10">Trade</span>
                <div className="absolute inset-0 scale-x-0 rounded-lg bg-gradient-to-r from-amber-950/50 to-purple-950/50 transition-transform group-hover:scale-x-100" />
                <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
              <Link
                to="/news"
                className="group relative px-6 py-2.5 font-serif text-sm font-medium tracking-wide text-amber-100 transition-all hover:text-amber-300"
              >
                <span className="relative z-10">News</span>
                <div className="absolute inset-0 scale-x-0 rounded-lg bg-gradient-to-r from-amber-950/50 to-purple-950/50 transition-transform group-hover:scale-x-100" />
                <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>

              {/* Cart button with golden border */}
              <Link
                to="/cart"
                className="group relative ml-4 overflow-hidden rounded-lg border border-amber-600/50 bg-gradient-to-r from-amber-950/50 to-purple-950/50 px-6 py-2.5 font-serif text-sm font-semibold tracking-wide text-amber-100 shadow-lg shadow-amber-900/30 transition-all hover:border-amber-500 hover:shadow-amber-500/40"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-amber-600/0 via-amber-600/10 to-amber-600/0 opacity-0 transition-opacity group-hover:opacity-100" />
                <span className="relative">Cart ({cartTotalItems})</span>
              </Link>
            </nav>
          </div>

          {/* Ornate bottom border */}
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
        </div>
      </header>

      {/* ROUTES */}
      <main className="relative z-10 mx-auto max-w-7xl px-8 py-10">
        <Routes>
          <Route
            path="/"
            element={
              <ShopPage
                cart={cart}
                addToCart={addToCart}
                removeFromCart={removeFromCart}
                updateQuantity={updateQuantity}
                cartTotalItems={cartTotalItems}
                cartTotalPrice={cartTotalPrice}
              />
            }
          />
          <Route
            path="/tcg/:tcgId"
            element={
              <ShopPage
                cart={cart}
                addToCart={addToCart}
                removeFromCart={removeFromCart}
                updateQuantity={updateQuantity}
                cartTotalItems={cartTotalItems}
                cartTotalPrice={cartTotalPrice}
              />
            }
          />
          <Route path="/trade" element={<TradePage />} />
          <Route path="/news" element={<NewsPage />} />
          <Route
            path="/cart"
            element={
              <CartPage
                cart={cart}
                removeFromCart={removeFromCart}
                updateQuantity={updateQuantity}
                cartTotalPrice={cartTotalPrice}
              />
            }
          />
        </Routes>
      </main>
    </div>
  );
}

export default App;
