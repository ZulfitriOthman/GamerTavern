// src/components/MarketTabs.jsx
import { NavLink, useLocation } from "react-router-dom";

const TABS = [
  {
    to: "/shop",
    label: "Shop",
    icon: "🛒",
    description: "Browse cards, collections, and marketplace items.",
  },
  {
    to: "/trade",
    label: "Trade",
    icon: "🤝",
    description: "Swap cards safely with other adventurers.",
  },
];

export default function MarketTabs({ children }) {
  const location = useLocation();

  const isShopActive =
    location.pathname === "/shop" ||
    location.pathname.startsWith("/tcg/") ||
    location.pathname.startsWith("/user/") ||
    location.pathname.startsWith("/vendor");

  const isTradeActive = location.pathname.startsWith("/trade");

  return (
    <div className="space-y-6">
      {/* Tab Bar */}
      <div className="relative overflow-hidden rounded-3xl border border-amber-900/40 bg-slate-950/80 p-3 shadow-2xl shadow-purple-950/40 backdrop-blur-xl">
        {/* Top glow line */}
        <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {TABS.map((tab) => {
            const active = tab.to === "/shop" ? isShopActive : isTradeActive;

            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={`
                  group relative overflow-hidden rounded-2xl border p-4 transition-all duration-300
                  ${
                    active
                      ? "border-amber-400/70 bg-gradient-to-br from-amber-950/70 via-purple-950/60 to-slate-950 text-amber-100 shadow-lg shadow-amber-950/30"
                      : "border-amber-900/30 bg-slate-950/70 text-amber-100/60 hover:border-amber-600/50 hover:bg-purple-950/30 hover:text-amber-100"
                  }
                `}
              >
                {/* Soft background glow */}
                <div
                  className={`
                    absolute inset-0 opacity-0 transition-opacity duration-300
                    ${
                      active
                        ? "opacity-100 bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-transparent"
                        : "group-hover:opacity-100 bg-gradient-to-r from-purple-500/10 to-transparent"
                    }
                  `}
                />

                <div className="relative flex items-center gap-4">
                  <div
                    className={`
                      flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border text-xl
                      ${
                        active
                          ? "border-amber-400/60 bg-amber-500/10"
                          : "border-amber-900/40 bg-slate-900/80"
                      }
                    `}
                  >
                    {tab.icon}
                  </div>

                  <div className="min-w-0">
                    <p className="font-serif text-base font-bold uppercase tracking-[0.18em]">
                      {tab.label}
                    </p>

                    <p className="mt-1 line-clamp-2 font-sans text-xs leading-relaxed text-amber-100/55">
                      {tab.description}
                    </p>
                  </div>
                </div>

                {active && (
                  <>
                    <span className="absolute left-0 top-0 h-3 w-3 border-l-2 border-t-2 border-amber-400" />
                    <span className="absolute right-0 top-0 h-3 w-3 border-r-2 border-t-2 border-amber-400" />
                    <span className="absolute bottom-0 left-0 h-3 w-3 border-b-2 border-l-2 border-amber-400" />
                    <span className="absolute bottom-0 right-0 h-3 w-3 border-b-2 border-r-2 border-amber-400" />
                  </>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* Bottom glow line */}
        <div className="absolute inset-x-6 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
      </div>

      {/* Tab Content */}
      <div>{children}</div>
    </div>
  );
}