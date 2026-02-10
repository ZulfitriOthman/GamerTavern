// App.jsx
import { useMemo, useState, useEffect, useRef } from "react";
import { Routes, Route, Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

import ShopPage from "./pages/ShopPage";
import CartPage from "./pages/CartPage";
import TradePage from "./pages/TradePage";
import NewsPage from "./pages/NewsPage";
import SocketDemo from "./pages/SocketDemo";
import SignUpPage from "./pages/SignUpPage";
import LoginPage from "./pages/LoginPage";
import ChatPage from "./pages/ChatPage";

// ✅ Socket.IO (no direct `socket` export anymore)
import { connectSocket, disconnectSocket, getSocket } from "./socket/socketClient";

const pageVariants = {
  initial: { opacity: 0, y: 16, filter: "blur(8px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -16, filter: "blur(8px)" },
};

function PageWrap({ children }) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

function readCurrentUser() {
  try {
    const raw = localStorage.getItem("tavern_current_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function App() {
  const location = useLocation();
  const navigate = useNavigate();

  const [cart, setCart] = useState([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // ✅ Logged-in user state (reads from localStorage)
  const [currentUser, setCurrentUser] = useState(() => readCurrentUser());

  // ✅ Username for socket presence (fallback to Traveler###)
  const [username] = useState(() => {
    const stored = localStorage.getItem("tavern_username");
    if (stored) return stored;

    const newUsername = `Traveler${Math.floor(Math.random() * 1000)}`;
    localStorage.setItem("tavern_username", newUsername);
    return newUsername;
  });

  const didConnectRef = useRef(false);

  // ✅ Show name in navbar
  const displayName = useMemo(() => {
    return currentUser?.name || localStorage.getItem("tavern_username") || "Traveler";
  }, [currentUser]);

  const isLoggedIn = !!currentUser?.id;

  // ✅ Keep currentUser synced (same tab + other tabs)
  useEffect(() => {
    const syncAuth = () => setCurrentUser(readCurrentUser());

    window.addEventListener("storage", syncAuth);
    window.addEventListener("tavern:authChanged", syncAuth);

    return () => {
      window.removeEventListener("storage", syncAuth);
      window.removeEventListener("tavern:authChanged", syncAuth);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("tavern_current_user");
    window.dispatchEvent(new Event("tavern:authChanged"));
    setMobileMenuOpen(false);
    navigate("/login");
  };

  // ✅ Socket connect once
  useEffect(() => {
    if (didConnectRef.current) return;
    didConnectRef.current = true;

    connectSocket(username);
    console.log("🎮 Connecting to Socket.IO as:", username);
  }, [username]);

  useEffect(() => {
    const onUnload = () => disconnectSocket();
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, []);

  const cartTotalItems = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart],
  );

  const cartTotalPrice = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity * item.price, 0),
    [cart],
  );

  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });

    const s = getSocket();
    if (s?.connected) {
      s.emit("cart:add", { productName: product.name });
    }
  };

  const removeFromCart = (id) => {
    setCart((prev) => prev.filter((i) => i.id !== id));
  };

  const updateQuantity = (id, qty) => {
    setCart((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, quantity: Math.max(1, qty) } : i))
        .filter((i) => i.quantity > 0),
    );
  };

  const desktopNavItems = useMemo(
    () => [
      { to: "/shop", label: "Shop" },
      { to: "/trade", label: "Trade" },
      { to: "/chat", label: "Chat" },
      { to: "/news", label: "News" },
      isLoggedIn
        ? { to: "/account", label: displayName } // change route if you want
        : { to: "/login", label: "Login" },
      { to: "/cart", label: `Cart (${cartTotalItems})` },
    ],
    [isLoggedIn, displayName, cartTotalItems],
  );

  const mobileNavItems = useMemo(
    () => [
      { to: "/shop", label: "Shop" },
      { to: "/trade", label: "Trade" },
      { to: "/chat", label: "Chat" },
      { to: "/news", label: "News" },
      isLoggedIn
        ? { to: "/account", label: displayName }
        : { to: "/login", label: "Login" },
      { to: "/cart", label: `Cart (${cartTotalItems})` },
    ],
    [isLoggedIn, displayName, cartTotalItems],
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-purple-950/30 to-slate-950 text-amber-50">
      {/* Mystical particle background */}
      <div className="fixed inset-0 z-0 opacity-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(139,92,246,0.3),transparent_50%)]" />
      </div>

      {/* NAVBAR */}
      <header className="sticky top-0 z-50 border-b border-amber-900/30 bg-slate-950/95 backdrop-blur-xl shadow-2xl shadow-purple-900/20">
        <div className="relative">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />

          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
            {/* Logo */}
            <Link
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className="group flex items-center gap-3 sm:gap-4 min-w-0"
            >
              <div className="relative shrink-0">
                <div className="absolute -inset-2 animate-pulse rounded-full bg-gradient-to-r from-amber-500/30 via-purple-500/30 to-amber-500/30 blur-xl" />
                <div className="relative h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-gradient-to-br from-amber-500 via-purple-600 to-amber-600 p-0.5 shadow-2xl shadow-amber-500/50">
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-slate-900 to-purple-950">
                    <span className="text-xl sm:text-2xl font-serif font-bold text-amber-400">
                      ⚔
                    </span>
                  </div>
                </div>
              </div>

              <div className="min-w-0">
                <h1 className="truncate font-serif text-lg sm:text-2xl font-bold tracking-wide text-amber-100">
                  TBC Name
                </h1>
                <p className="hidden sm:block font-serif text-xs italic tracking-wider text-amber-600">
                  Collector&apos;s Sanctum & Trading Post
                </p>
              </div>
            </Link>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-2">
              <nav className="flex items-center gap-1">
                {desktopNavItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `group relative px-5 lg:px-6 py-2.5 font-serif text-sm font-medium tracking-wide transition-all
                      ${
                        isActive
                          ? "text-amber-400"
                          : "text-amber-100 hover:text-amber-300"
                      }`
                    }
                  >
                    <span className="relative z-10">{item.label}</span>
                    <div className="absolute inset-0 scale-x-0 rounded-lg bg-gradient-to-r from-amber-950/50 to-purple-950/50 transition-transform group-hover:scale-x-100" />
                    <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                  </NavLink>
                ))}
              </nav>

              {/* ✅ Logout */}
              {isLoggedIn ? (
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center rounded-lg border border-amber-600/40 bg-amber-950/20 px-4 py-2 font-serif text-sm text-amber-100 hover:border-amber-500 hover:bg-amber-950/30 transition"
                >
                  Logout
                </button>
              ) : null}
            </div>

            {/* Mobile controls */}
            <div className="flex items-center gap-2 md:hidden">
              <Link
                to="/cart"
                onClick={() => setMobileMenuOpen(false)}
                className="relative rounded-lg border border-amber-600/50 bg-gradient-to-r from-amber-950/50 to-purple-950/50 px-3 py-2 font-serif text-sm font-semibold tracking-wide text-amber-100"
              >
                Cart ({cartTotalItems})
              </Link>

              <button
                type="button"
                aria-label="Toggle menu"
                aria-expanded={mobileMenuOpen}
                onClick={() => setMobileMenuOpen((v) => !v)}
                className="rounded-lg border border-amber-900/40 bg-slate-950/60 px-3 py-2 text-amber-100"
              >
                <span className="block h-0.5 w-5 bg-current mb-1" />
                <span className="block h-0.5 w-5 bg-current mb-1" />
                <span className="block h-0.5 w-5 bg-current" />
              </button>
            </div>
          </div>

          {/* Mobile menu panel */}
          <div
            className={`md:hidden overflow-hidden transition-all duration-300 ease-out
              ${mobileMenuOpen ? "max-h-[520px] opacity-100 translate-y-0" : "max-h-0 opacity-0 -translate-y-2"}
            `}
          >
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-4 pt-2">
              <div className="rounded-xl border border-amber-900/30 bg-slate-950/70 backdrop-blur-xl overflow-hidden shadow-2xl shadow-purple-900/20">
                {mobileNavItems.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className="group block px-4 py-3 font-serif text-sm text-amber-100 hover:bg-amber-950/30 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span>{item.label}</span>
                      <span className="opacity-0 translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0">
                        →
                      </span>
                    </div>
                  </Link>
                ))}

                {/* ✅ Mobile Logout */}
                {isLoggedIn ? (
                  <button
                    onClick={handleLogout}
                    className="w-full text-left group block px-4 py-3 font-serif text-sm text-amber-100 hover:bg-amber-950/30 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span>Logout</span>
                      <span className="opacity-0 translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0">
                        →
                      </span>
                    </div>
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
        </div>
      </header>

      {/* ROUTES */}
      <main className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route
              path="/"
              element={
                <PageWrap>
                  <NewsPage />
                </PageWrap>
              }
            />

            <Route
              path="/shop"
              element={
                <PageWrap>
                  <ShopPage
                    cart={cart}
                    addToCart={addToCart}
                    removeFromCart={removeFromCart}
                    updateQuantity={updateQuantity}
                    cartTotalItems={cartTotalItems}
                    cartTotalPrice={cartTotalPrice}
                  />
                </PageWrap>
              }
            />

            <Route
              path="/tcg/:cardId"
              element={
                <PageWrap>
                  <ShopPage
                    cart={cart}
                    addToCart={addToCart}
                    removeFromCart={removeFromCart}
                    updateQuantity={updateQuantity}
                    cartTotalItems={cartTotalItems}
                    cartTotalPrice={cartTotalPrice}
                  />
                </PageWrap>
              }
            />

            <Route
              path="/trade"
              element={
                <PageWrap>
                  <TradePage />
                </PageWrap>
              }
            />

            <Route
              path="/news"
              element={
                <PageWrap>
                  <NewsPage />
                </PageWrap>
              }
            />

            <Route
              path="/chat"
              element={
                <PageWrap>
                  <ChatPage />
                </PageWrap>
              }
            />

            <Route
              path="/login"
              element={
                <PageWrap>
                  <LoginPage />
                </PageWrap>
              }
            />

            <Route
              path="/signup"
              element={
                <PageWrap>
                  <SignUpPage />
                </PageWrap>
              }
            />

            <Route
              path="/socket-demo"
              element={
                <PageWrap>
                  <SocketDemo />
                </PageWrap>
              }
            />

            <Route
              path="/cart"
              element={
                <PageWrap>
                  <CartPage
                    cart={cart}
                    removeFromCart={removeFromCart}
                    updateQuantity={updateQuantity}
                    cartTotalPrice={cartTotalPrice}
                  />
                </PageWrap>
              }
            />

            {/* ✅ Optional placeholder route so "name" link doesn't 404 */}
            <Route
              path="/account"
              element={
                <PageWrap>
                  <div className="rounded-2xl border border-amber-900/30 bg-slate-950/60 p-8">
                    <h2 className="font-serif text-2xl font-bold text-amber-100">
                      Account
                    </h2>
                    <p className="mt-2 font-serif text-amber-100/70">
                      Logged in as <span className="text-amber-300">{displayName}</span>
                    </p>
                    <button
                      onClick={handleLogout}
                      className="mt-6 rounded-xl border border-amber-600/40 bg-amber-950/20 px-4 py-2 font-serif text-sm text-amber-100 hover:border-amber-500 hover:bg-amber-950/30 transition"
                    >
                      Logout
                    </button>
                  </div>
                </PageWrap>
              }
            />
          </Routes>
        </AnimatePresence>
      </main>
    </div>
  );
}

export default App;
