// App.jsx
import { useMemo, useState, useEffect, useRef } from "react";
import {
  Routes,
  Route,
  Link,
  NavLink,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Navigate } from "react-router-dom";

import CartPage from "./pages/CartPage";
import TradePage from "./pages/TradePage";
import NewsPage from "./pages/NewsPage";
import SocketDemo from "./pages/SocketDemo";
import SignUpPage from "./pages/login/SignUpPage";
import ProfilePage from "./pages/profile/ProfilePage";
import LoginPage from "./pages/login/LoginPage";
import ForgotPasswordPage from "./pages/login/ForgotPasswordPage";
import ChatPage from "./pages/ChatPage";
import UserShopPage from "./pages/UserShopPage";
import VendorShopPage from "./pages/VendorShopPage";
import ProductDetailPage from "./pages/ProductDetailPage";

// ✅ Socket.IO (no direct `socket` export anymore)
import {
  connectSocket,
  disconnectSocket,
  getSocket,
} from "./socket/socketClient";
import {
  clearAuthStorage,
  getCurrentUser,
  getUsername,
  setUsername,
} from "./authStorage";

const pageVariants = {
  initial: { opacity: 0, y: 16, filter: "blur(8px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -16, filter: "blur(8px)" },
};

function ArcaneNavItem({
  to,
  label,
  isActive,
  onClick,
  variant = "desktop", // "desktop" | "mobileRow" | "mobilePill"
}) {
  const base =
    variant === "mobileRow"
      ? "group relative block px-4 py-3 font-serif text-sm transition-colors"
      : variant === "mobilePill"
        ? "group relative rounded-lg px-3 py-2 font-serif text-sm font-semibold tracking-wide transition-all"
        : "group relative px-5 lg:px-6 py-2.5 font-serif text-sm font-medium tracking-wide transition-all";

  const colors =
    variant === "mobileRow"
      ? isActive
        ? "text-amber-300 bg-amber-950/25"
        : "text-amber-100 hover:bg-amber-950/30"
      : isActive
        ? "text-amber-400"
        : "text-amber-100 hover:text-amber-300";

  return (
    <Link to={to} onClick={onClick} className={[base, colors].join(" ")}>
      <span className="relative z-10 flex items-center justify-between">
        <span>{label}</span>
        {variant === "mobileRow" ? (
          <span className="opacity-0 translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0">
            →
          </span>
        ) : null}
      </span>

      {/* Base backgrounds */}
      {variant === "mobilePill" ? (
        <span className="absolute inset-0 rounded-lg border border-amber-600/50 bg-gradient-to-r from-amber-950/50 to-purple-950/50" />
      ) : null}

      {variant === "desktop" ? (
        <>
          {/* Hover background */}
          <div className="absolute inset-0 scale-x-0 rounded-lg bg-gradient-to-r from-amber-950/50 to-purple-950/50 transition-transform group-hover:scale-x-100" />
          {/* Bottom glow line */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        </>
      ) : null}

      {/* ✅ Active square-line frame + corners */}
      {isActive ? (
        <>
          <span className="pointer-events-none absolute inset-0 rounded-md border border-amber-500/70 scale-95 opacity-0 transition-all duration-300 group-hover:scale-100 group-hover:opacity-100" />
          <span className="absolute left-0 top-0 h-2 w-2 border-l-2 border-t-2 border-amber-400" />
          <span className="absolute right-0 top-0 h-2 w-2 border-r-2 border-t-2 border-amber-400" />
          <span className="absolute left-0 bottom-0 h-2 w-2 border-l-2 border-b-2 border-amber-400" />
          <span className="absolute right-0 bottom-0 h-2 w-2 border-r-2 border-b-2 border-amber-400" />
        </>
      ) : null}
    </Link>
  );
}

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
  return getCurrentUser();
}

function RequireAuth({ children }) {
  const location = useLocation();
  const user = getCurrentUser();

  if (!user?.id) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}

function ShopEntryRedirect() {
  const navigate = useNavigate();
  const { tcgId } = useParams();

  useEffect(() => {
    const user = getCurrentUser();

    if (!user?.id) {
      navigate("/login", { replace: true });
      return;
    }

    const role = String(user?.role || "USER").toUpperCase();
    const isVendor = role === "VENDOR" || role === "ADMIN";

    // preserve tcgId if present
    if (tcgId) {
      navigate(isVendor ? `/vendor/tcg/${tcgId}` : `/user/tcg/${tcgId}`, {
        replace: true,
      });
    } else {
      // ✅ FIX: you don't have /vendor/shop route, use /vendor (which redirects)
      navigate(isVendor ? "/vendor" : "/user/shop", { replace: true });
    }
  }, [navigate, tcgId]);

  return null;
}

function App() {
  const location = useLocation();
  const isShopRoute = useMemo(() => {
    const p = location.pathname;
    return (
      p === "/shop" ||
      p.startsWith("/user/") ||
      p.startsWith("/vendor/") ||
      p.startsWith("/tcg/") ||
      p.startsWith("/product/") // optional: keep Shop active on product details
    );
  }, [location.pathname]);
  const isCartRoute = useMemo(
    () => location.pathname.startsWith("/cart"),
    [location.pathname],
  );

  const isTradeRoute = useMemo(
    () => location.pathname.startsWith("/trade"),
    [location.pathname],
  );

  const isChatRoute = useMemo(
    () => location.pathname.startsWith("/chat"),
    [location.pathname],
  );

  const isNewsRoute = useMemo(() => {
    const p = location.pathname;
    return p === "/" || p.startsWith("/news");
  }, [location.pathname]);

  const isAccountRoute = useMemo(
    () =>
      location.pathname.startsWith("/profile") ||
      location.pathname.startsWith("/account"),
    [location.pathname],
  );

  const isAuthRoute = useMemo(() => {
    const p = location.pathname;
    return p.startsWith("/login") || p.startsWith("/signup");
  }, [location.pathname]);
  const navigate = useNavigate();

  const [cart, setCart] = useState([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // ✅ Logged-in user state (reads from localStorage)
  const [currentUser, setCurrentUser] = useState(() => readCurrentUser());

  // ✅ Username for socket presence (fallback to Traveler###)
  const [username] = useState(() => {
    const stored = getUsername();
    if (stored) return stored;

    const newUsername = `Traveler${Math.floor(Math.random() * 1000)}`;
    setUsername(newUsername);
    return newUsername;
  });

  const didConnectRef = useRef(false);

  // ✅ Show name in navbar
  const displayName = useMemo(() => {
    return currentUser?.name || getUsername("Traveler") || "Traveler";
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
    clearAuthStorage();
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

  const mobileNavItems = useMemo(
    () =>
      isLoggedIn
        ? [
            { to: "/shop", label: "Shop" },
            { to: "/trade", label: "Trade" },
            { to: "/chat", label: "Chat" },
            { to: "/news", label: "News" },
            { to: "/profile", label: displayName },
            { to: "/cart", label: `Cart (${cartTotalItems})` },
          ]
        : [
            { to: "/news", label: "News" },
            { to: "/login", label: "Login" },
            { to: "/signup", label: "Sign Up" },
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
                {isLoggedIn ? (
                  <ArcaneNavItem
                    to="/shop"
                    label="Shop"
                    isActive={isShopRoute}
                    variant="desktop"
                    onClick={() => setMobileMenuOpen(false)}
                  />
                ) : null}

                {isLoggedIn ? (
                  <ArcaneNavItem
                    to="/trade"
                    label="Trade"
                    isActive={isTradeRoute}
                    variant="desktop"
                  />
                ) : null}

                {isLoggedIn ? (
                  <ArcaneNavItem
                    to="/chat"
                    label="Chat"
                    isActive={isChatRoute}
                    variant="desktop"
                  />
                ) : null}

                <ArcaneNavItem
                  to="/news"
                  label="News"
                  isActive={isNewsRoute}
                  variant="desktop"
                />

                {isLoggedIn ? (
                  <ArcaneNavItem
                    to="/profile"
                    label={displayName}
                    isActive={isAccountRoute}
                    variant="desktop"
                  />
                ) : (
                  <ArcaneNavItem
                    to="/login"
                    label="Login"
                    isActive={isAuthRoute}
                    variant="desktop"
                  />
                )}

                {isLoggedIn ? (
                  <ArcaneNavItem
                    to="/cart"
                    label={`Cart (${cartTotalItems})`}
                    isActive={isCartRoute}
                    variant="desktop"
                  />
                ) : null}
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
              {isLoggedIn ? (
                <Link
                  to="/cart"
                  onClick={() => setMobileMenuOpen(false)}
                  className="relative rounded-lg border border-amber-600/50 bg-gradient-to-r from-amber-950/50 to-purple-950/50 px-3 py-2 font-serif text-sm font-semibold tracking-wide text-amber-100"
                >
                  Cart ({cartTotalItems})
                </Link>
              ) : null}

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

            {/* ✅ Smart Shop Entry Route */}
            <Route
              path="/shop"
              element={
                <RequireAuth>
                  <PageWrap>
                    <ShopEntryRedirect />
                  </PageWrap>
                </RequireAuth>
              }
            />

            {/* ✅ Fix param name (tcgId) */}
            <Route
              path="/tcg/:tcgId"
              element={
                <RequireAuth>
                  <PageWrap>
                    <ShopEntryRedirect />
                  </PageWrap>
                </RequireAuth>
              }
            />

            {/* ✅ USER SHOP */}
            <Route
              path="/user/shop"
              element={
                <RequireAuth>
                  <PageWrap>
                    <UserShopPage
                      cart={cart}
                      addToCart={addToCart}
                      removeFromCart={removeFromCart}
                      updateQuantity={updateQuantity}
                      cartTotalItems={cartTotalItems}
                      cartTotalPrice={cartTotalPrice}
                    />
                  </PageWrap>
                </RequireAuth>
              }
            />

            <Route
              path="/user/tcg/:tcgId"
              element={
                <RequireAuth>
                  <PageWrap>
                    <UserShopPage
                      cart={cart}
                      addToCart={addToCart}
                      removeFromCart={removeFromCart}
                      updateQuantity={updateQuantity}
                      cartTotalItems={cartTotalItems}
                      cartTotalPrice={cartTotalPrice}
                    />
                  </PageWrap>
                </RequireAuth>
              }
            />

            {/* ✅ VENDOR SHOP */}
            <Route
              path="/vendor"
              element={
                <RequireAuth>
                  <Navigate to="/vendor/tcg/mtg" replace />
                </RequireAuth>
              }
            />

            <Route
              path="/vendor/tcg/:tcgId"
              element={
                <RequireAuth>
                  <PageWrap>
                    <VendorShopPage
                      cart={cart}
                      addToCart={addToCart}
                      removeFromCart={removeFromCart}
                      updateQuantity={updateQuantity}
                      cartTotalItems={cartTotalItems}
                      cartTotalPrice={cartTotalPrice}
                    />
                  </PageWrap>
                </RequireAuth>
              }
            />

            <Route
              path="/vendor/product/:id"
              element={
                <RequireAuth>
                  <PageWrap>
                    <ProductDetailPage addToCart={addToCart} />
                  </PageWrap>
                </RequireAuth>
              }
            />

            <Route
              path="/product/:id"
              element={
                <RequireAuth>
                  <PageWrap>
                    <ProductDetailPage addToCart={addToCart} />
                  </PageWrap>
                </RequireAuth>
              }
            />

            <Route
              path="/trade"
              element={
                <RequireAuth>
                  <PageWrap>
                    <TradePage />
                  </PageWrap>
                </RequireAuth>
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
                <RequireAuth>
                  <PageWrap>
                    <ChatPage />
                  </PageWrap>
                </RequireAuth>
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
              path="/forgot-password"
              element={
                <PageWrap>
                  <ForgotPasswordPage />
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
                <RequireAuth>
                  <PageWrap>
                    <CartPage
                      cart={cart}
                      removeFromCart={removeFromCart}
                      updateQuantity={updateQuantity}
                      cartTotalPrice={cartTotalPrice}
                      clearCart={() => setCart([])}
                    />
                  </PageWrap>
                </RequireAuth>
              }
            />

            {/* ✅ Profile page (account settings) */}
            <Route
              path="/profile"
              element={
                <RequireAuth>
                  <PageWrap>
                    <ProfilePage />
                  </PageWrap>
                </RequireAuth>
              }
            />
          </Routes>
        </AnimatePresence>
      </main>
    </div>
  );
}

export default App;
