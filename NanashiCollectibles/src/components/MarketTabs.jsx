// src/components/MarketTabs.jsx
import { NavLink, useLocation } from "react-router-dom";

const TABS = [
  { to: "/shop", label: "Shop", icon: "🛒", description: "Browse the vault" },
  { to: "/trade", label: "Trade", icon: "🤝", description: "Swap with adventurers" },
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
    <div className="space-y-5">
      {/* Tab Bar */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-900/40 bg-gradient-to-br from-slate-950 via-purple-950/40 to-slate-950 p-2 shadow-lg shadow-purple-900/20">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />

        <div className="relative grid grid-cols-2 gap-2">
          {TABS.map((tab) => {
            const active =
              tab.to === "/shop" ? isShopActive : isTradeActive;
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={`group relative flex items-center justify-center gap-2 rounded-xl border px-4 py-3 font-serif text-sm font-semibold uppercase tracking-wider transition-all duration-200 ${
                  active
                    ? "border-amber-500/60 bg-gradient-to-r from-amber-950/60 to-purple-950/60 text-amber-100 shadow-lg shadow-amber-900/30"
                    : "border-amber-900/30 bg-slate-950/50 text-amber-100/60 hover:border-amber-700/50 hover:bg-slate-900/70 hover:text-amber-200"
                }`}
              >
                <span className="text-lg">{tab.icon}</span>
                <div className="flex flex-col items-start leading-tight">
                  <span>{tab.label}</span>
                  <span className="font-sans text-[10px] font-normal normal-case tracking-normal text-amber-100/50">
                    {tab.description}
                  </span>
                </div>
                {active && (
                  <>
                    <span className="absolute left-0 top-0 h-2 w-2 border-l-2 border-t-2 border-amber-400" />
                    <span className="absolute right-0 top-0 h-2 w-2 border-r-2 border-t-2 border-amber-400" />
                    <span className="absolute bottom-0 left-0 h-2 w-2 border-b-2 border-l-2 border-amber-400" />
                    <span className="absolute bottom-0 right-0 h-2 w-2 border-b-2 border-r-2 border-amber-400" />
                  </>
                )}
              </NavLink>
            );
          })}
        </div>

        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
      </div>

      {/* Tab Content */}
      <div>{children}</div>
    </div>
  );
}
