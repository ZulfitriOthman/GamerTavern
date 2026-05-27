// App.jsx
import { useMemo, useState, useEffect, useRef } from "react";
import {
  Routes,
  Route,
  Link,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Navigate } from "react-router-dom";

import CartPage from "./pages/CartPage";
import TradePage from "./pages/shop/TradePage";
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
import MarketTabs from "./components/MarketTabs";

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
  initial: { opacity: 0, y: 18, filter: "blur(8px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -18, filter: "blur(8px)" },
};

const sceneBackgrounds = {
  news: {
    title: "News",
    subtitle: "Latest updates from the trading realm.",
    bg: "/assets/game-bg/news-bg.jpg",
  },
  shop: {
    title: "Shop",
    subtitle: "Browse cards, collections, and marketplace items.",
    bg: "/assets/game-bg/shop-bg.jpg",
  },
  trade: {
    title: "Trade",
    subtitle: "Exchange cards with other collectors.",
    bg: "/assets/game-bg/trade-bg.jpg",
  },
  chat: {
    title: "Chat",
    subtitle: "Connect with other players and collectors.",
    bg: "/assets/game-bg/chat-bg.jpg",
  },
  profile: {
    title: "Profile",
    subtitle: "Manage your player account.",
    bg: "/assets/game-bg/profile-bg.jpg",
  },
  cart: {
    title: "Cart",
    subtitle: "Review your selected items.",
    bg: "/assets/game-bg/cart-bg.jpg",
  },
  auth: {
    title: "Account",
    subtitle: "Login or create a new account.",
    bg: "/assets/game-bg/auth-bg.jpg",
  },
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

    if (tcgId) {
      navigate(isVendor ? `/vendor/tcg/${tcgId}` : `/user/tcg/${tcgId}`, {
        replace: true,
      });
    } else {
      navigate(isVendor ? "/vendor" : "/user/shop", { replace: true });
    }
  }, [navigate, tcgId]);

  return null;
}

function GameMenuButton({ to, label, active, badge, onClick }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={[
        "group relative block h-[56px] overflow-hidden border border-white/10 text-center font-serif text-lg font-black uppercase tracking-[0.14em] transition-all duration-300",
        active
          ? "bg-purple-500 text-white shadow-[0_0_28px_rgba(168,85,247,0.45)]"
          : "bg-white/10 text-white/85 hover:bg-purple-500/80 hover:text-white",
      ].join(" ")}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <div className="relative z-10 flex h-full items-center justify-center gap-3">
        <span className="hidden text-sm opacity-80 sm:inline">◇</span>
        <span>{label}</span>

        {badge ? (
          <span className="rounded-full bg-black/35 px-2 py-0.5 text-xs">
            {badge}
          </span>
        ) : null}

        <span className="hidden text-sm opacity-80 sm:inline">◇</span>
      </div>
    </Link>
  );
}

function App() {
  const location = useLocation();
  const navigate = useNavigate();

  const isShopRoute = useMemo(() => {
    const p = location.pathname;
    return (
      p === "/shop" ||
      p.startsWith("/user/") ||
      p.startsWith("/vendor/") ||
      p.startsWith("/tcg/") ||
      p.startsWith("/product/") ||
      p.startsWith("/trade")
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
    return (
      p.startsWith("/login") ||
      p.startsWith("/signup") ||
      p.startsWith("/forgot-password")
    );
  }, [location.pathname]);

  const [cart, setCart] = useState([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => readCurrentUser());

  const [username] = useState(() => {
    const stored = getUsername();
    if (stored) return stored;

    const newUsername = `Traveler${Math.floor(Math.random() * 1000)}`;
    setUsername(newUsername);
    return newUsername;
  });

  const didConnectRef = useRef(false);

  const displayName = useMemo(() => {
    return currentUser?.name || getUsername("Traveler") || "Traveler";
  }, [currentUser]);

  const isLoggedIn = !!currentUser?.id;

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

  const currentScene = useMemo(() => {
    if (isTradeRoute) return "trade";
    if (isShopRoute) return "shop";
    if (isChatRoute) return "chat";
    if (isAccountRoute) return "profile";
    if (isCartRoute) return "cart";
    if (isAuthRoute) return "auth";
    return "news";
  }, [
    isTradeRoute,
    isShopRoute,
    isChatRoute,
    isAccountRoute,
    isCartRoute,
    isAuthRoute,
  ]);

  const scene = sceneBackgrounds[currentScene];

  const menuItems = useMemo(() => {
    if (isLoggedIn) {
      return [
        { to: "/shop", label: "Shop", active: isShopRoute && !isTradeRoute },
        { to: "/trade", label: "Trade", active: isTradeRoute },
        { to: "/chat", label: "Chat", active: isChatRoute },
        { to: "/news", label: "News", active: isNewsRoute },
        {
          to: "/cart",
          label: "Cart",
          active: isCartRoute,
          badge: cartTotalItems,
        },
      ];
    }

    return [
      { to: "/login", label: "Login", active: location.pathname === "/login" },
      {
        to: "/signup",
        label: "Sign Up",
        active: location.pathname === "/signup",
      },
      { to: "/news", label: "News", active: isNewsRoute },
    ];
  }, [
    isLoggedIn,
    isShopRoute,
    isTradeRoute,
    isChatRoute,
    isNewsRoute,
    isCartRoute,
    cartTotalItems,
    location.pathname,
  ]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-white">
      {/* FULL BACKGROUND */}
      <motion.div
        key={scene.bg}
        initial={{ scale: 1.04, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.55, ease: "easeOut" }}
        className="fixed inset-0 z-0 bg-cover bg-center"
        style={{
          backgroundImage: `url('${scene.bg}')`,
        }}
      />

      {/* BACKGROUND FILTERS */}
      <div className="fixed inset-0 z-0 bg-gradient-to-r from-black via-black/30 to-black/10" />
      <div className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_72%_50%,transparent_0%,rgba(0,0,0,0.25)_42%,rgba(0,0,0,0.9)_100%)]" />
      <div className="fixed inset-0 z-0 bg-black/15" />

      {/* LEFT MENU PANEL */}
      <aside className="fixed left-0 top-0 z-30 flex h-screen w-full flex-col bg-[#171717]/92 px-6 py-8 shadow-2xl backdrop-blur-md sm:w-[390px] lg:w-[430px]">
        {/* LOGO / TITLE */}
        <Link
          to="/"
          onClick={() => setMobileMenuOpen(false)}
          className="mx-auto mb-10 block text-center"
        >
          <div className="relative">
            <h1 className="font-serif text-5xl font-black uppercase leading-none tracking-[0.08em] text-purple-400 drop-shadow-[0_0_18px_rgba(192,132,252,0.75)] sm:text-6xl">
              TBC
            </h1>
            <h2 className="font-serif text-6xl font-black uppercase leading-none tracking-[0.04em] text-purple-400 drop-shadow-[0_0_18px_rgba(192,132,252,0.75)] sm:text-7xl">
              Name
            </h2>

            <div className="mx-auto mt-4 h-px w-56 bg-gradient-to-r from-transparent via-purple-400 to-transparent" />
            <p className="mt-3 text-xs font-black uppercase tracking-[0.35em] text-white/45">
              Collector Sanctum
            </p>
          </div>
        </Link>

        {/* DESKTOP MENU */}
        <nav className="hidden space-y-4 sm:block">
          {menuItems.map((item) => (
            <GameMenuButton
              key={item.to}
              to={item.to}
              label={item.label}
              active={item.active}
              badge={item.badge}
              onClick={() => setMobileMenuOpen(false)}
            />
          ))}

          {isLoggedIn ? (
            <GameMenuButton
              to="/profile"
              label="Profile"
              active={isAccountRoute}
              onClick={() => setMobileMenuOpen(false)}
            />
          ) : null}

          {isLoggedIn ? (
            <button
              onClick={handleLogout}
              className="relative block h-[56px] w-full overflow-hidden border border-white/10 bg-white/10 text-center font-serif text-lg font-black uppercase tracking-[0.14em] text-white/85 transition-all duration-300 hover:bg-red-500/70 hover:text-white"
            >
              Exit
            </button>
          ) : null}
        </nav>

        {/* MOBILE MENU TOGGLE */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen((value) => !value)}
          className="mb-4 block border border-white/10 bg-purple-500 px-5 py-4 font-serif text-lg font-black uppercase tracking-[0.14em] text-white sm:hidden"
        >
          Menu
        </button>

        {/* MOBILE MENU */}
        <nav
          className={[
            "space-y-3 overflow-hidden transition-all duration-300 sm:hidden",
            mobileMenuOpen ? "max-h-[520px] opacity-100" : "max-h-0 opacity-0",
          ].join(" ")}
        >
          {menuItems.map((item) => (
            <GameMenuButton
              key={item.to}
              to={item.to}
              label={item.label}
              active={item.active}
              badge={item.badge}
              onClick={() => setMobileMenuOpen(false)}
            />
          ))}

          {isLoggedIn ? (
            <GameMenuButton
              to="/profile"
              label="Profile"
              active={isAccountRoute}
              onClick={() => setMobileMenuOpen(false)}
            />
          ) : null}

          {isLoggedIn ? (
            <button
              onClick={handleLogout}
              className="relative block h-[56px] w-full overflow-hidden border border-white/10 bg-white/10 text-center font-serif text-lg font-black uppercase tracking-[0.14em] text-white/85 transition-all duration-300 hover:bg-red-500/70 hover:text-white"
            >
              Exit
            </button>
          ) : null}
        </nav>

        {/* BOTTOM STATUS */}
        <div className="mt-auto">
          <div className="mb-5 border border-white/10 bg-black/30 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/40">
              Current Mode
            </p>
            <h3 className="mt-1 font-serif text-2xl font-black uppercase text-white">
              {scene.title}
            </h3>
            <p className="mt-1 text-xs text-white/50">{scene.subtitle}</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-indigo-500/80 text-xl">
              ☯
            </div>

            <div className="flex flex-1 items-center justify-center rounded-md border border-lime-300/30 bg-lime-400/10 px-3 py-3 text-center text-xs font-black uppercase tracking-[0.16em] text-lime-200">
              {isLoggedIn ? displayName : "Guest Player"}
            </div>

            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-sky-500/80 text-xl">
              ✦
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="relative z-20 min-h-screen pl-0 sm:pl-[390px] lg:pl-[430px]">
        <div className="min-h-screen p-4 sm:p-6 lg:p-8">
          <div className="ml-auto max-w-6xl">
            <motion.div
              key={currentScene}
              initial={{ opacity: 0, y: 14, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="mb-5 hidden rounded-2xl border border-white/10 bg-black/35 p-5 shadow-2xl backdrop-blur-md sm:block"
            >
              <p className="text-xs font-black uppercase tracking-[0.35em] text-purple-300">
                Selected Mode
              </p>
              <h2 className="mt-2 font-serif text-4xl font-black uppercase text-white">
                {scene.title}
              </h2>
              <p className="mt-1 text-white/60">{scene.subtitle}</p>
            </motion.div>

            <section className="rounded-2xl border border-white/10 bg-black/45 p-4 shadow-2xl backdrop-blur-md sm:p-6">
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
                      <RequireAuth>
                        <PageWrap>
                          <ShopEntryRedirect />
                        </PageWrap>
                      </RequireAuth>
                    }
                  />

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

                  <Route
                    path="/user/shop"
                    element={
                      <RequireAuth>
                        <PageWrap>
                          <MarketTabs>
                            <UserShopPage
                              cart={cart}
                              addToCart={addToCart}
                              removeFromCart={removeFromCart}
                              updateQuantity={updateQuantity}
                              cartTotalItems={cartTotalItems}
                              cartTotalPrice={cartTotalPrice}
                            />
                          </MarketTabs>
                        </PageWrap>
                      </RequireAuth>
                    }
                  />

                  <Route
                    path="/user/tcg/:tcgId"
                    element={
                      <RequireAuth>
                        <PageWrap>
                          <MarketTabs>
                            <UserShopPage
                              cart={cart}
                              addToCart={addToCart}
                              removeFromCart={removeFromCart}
                              updateQuantity={updateQuantity}
                              cartTotalItems={cartTotalItems}
                              cartTotalPrice={cartTotalPrice}
                            />
                          </MarketTabs>
                        </PageWrap>
                      </RequireAuth>
                    }
                  />

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
                          <MarketTabs>
                            <VendorShopPage
                              cart={cart}
                              addToCart={addToCart}
                              removeFromCart={removeFromCart}
                              updateQuantity={updateQuantity}
                              cartTotalItems={cartTotalItems}
                              cartTotalPrice={cartTotalPrice}
                            />
                          </MarketTabs>
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
                          <MarketTabs>
                            <TradePage />
                          </MarketTabs>
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
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;