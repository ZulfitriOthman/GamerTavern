import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../features/auth/AuthContext.js";

const dropdownLinkClasses = ({ isActive }) =>
  [
    "block rounded-lg px-3 py-2 text-sm transition-colors duration-150 focus-ring",
    isActive ? "bg-white/5 text-amber-50" : "text-amber-50/80 hover:bg-white/5 hover:text-amber-50",
  ].join(" ");

// Compact account trigger — an initial avatar + chevron instead of the full
// name sitting permanently in the navbar. The name/email still show, just
// inside the panel (first thing in it), matching the redesigned navbar's
// "utility actions stay compact, detail lives one click away" rule. No
// "Account" (settings/profile) link here — no customer-facing account page
// exists yet in this app; adding one would be a routing change, not a nav
// redesign, so this only ever lists what already exists (Orders, Log out).
export default function AccountMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const toggleRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event) {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const initial = (user.name || "?").trim().charAt(0).toUpperCase();

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={toggleRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Account menu — ${user.name}`}
        className="flex items-center gap-1.5 rounded-full py-0.5 pr-1 text-sm text-amber-50/60 transition-colors duration-150 hover:text-amber-50 focus-ring"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500/15 text-xs font-semibold text-brand-300">
          {initial}
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          className={["h-3.5 w-3.5 text-amber-50/40 transition-transform duration-150", open ? "rotate-180" : ""].join(" ")}
        >
          <path d="M5 7.5l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Account"
          className="dropdown-panel-enter-right absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-white/10 bg-ink-800 p-1.5 shadow-xl shadow-black/40"
        >
          <div className="px-3 py-2">
            <p className="truncate text-sm font-medium text-amber-50">{user.name}</p>
            <p className="truncate text-xs text-amber-50/45">{user.email}</p>
          </div>
          <div className="my-1 h-px bg-white/10" role="none" />
          <NavLink role="menuitem" to="/orders" onClick={() => setOpen(false)} className={dropdownLinkClasses}>
            Orders
          </NavLink>
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              logout();
            }}
            className="block w-full rounded-lg px-3 py-2 text-left text-sm text-amber-50/80 transition-colors duration-150 hover:bg-white/5 hover:text-amber-50 focus-ring"
          >
            Log out
          </button>
        </div>
      ) : null}
    </div>
  );
}
