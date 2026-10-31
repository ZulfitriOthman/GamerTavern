import { useEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";

// Controlled by Header (via isOpen/onOpen/onClose) so only one primary-nav
// dropdown is ever open at a time, and hovering across an already-open
// dropdown onto a sibling trigger switches straight to it — the standard
// menu-bar pattern. Opening itself is click/Enter/Space/tap-driven (native
// <button> semantics cover keyboard for free); hover is only ever a
// convenience on top of that, never required — see Header.jsx for why a
// naive "hover sets open" + "click toggles open" combination is a bug
// (hovering over the trigger before a real click already flips it open, so
// a plain toggle immediately closes it again on the click that follows).
// `to`, when present, also counts toward the trigger's active state (e.g.
// "Services" has its own /services page in addition to its children); a
// dropdown with no landing page of its own (e.g. "Explore") omits `to` and
// is active only when a child route matches.
export default function NavDropdown({ label, to, items, isOpen, anyOpen, onOpen, onClose }) {
  const location = useLocation();
  const containerRef = useRef(null);
  const triggerRef = useRef(null);

  const isActive =
    (to != null && location.pathname === to) ||
    items.some((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`));

  useEffect(() => {
    if (!isOpen) return undefined;

    function handlePointerDown(event) {
      if (!containerRef.current?.contains(event.target)) onClose();
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Only "follow" a hover onto this trigger while some OTHER dropdown is
  // already open (the menu-bar pattern) — hovering onto this trigger from a
  // fully-closed state never opens it by itself, which is exactly what
  // avoids the open-via-hover-then-click-recloses bug described above.
  function handleMouseEnter() {
    if (anyOpen && !isOpen) onOpen();
  }

  return (
    <div ref={containerRef} className="relative" onMouseEnter={handleMouseEnter}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (isOpen ? onClose() : onOpen())}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className={[
          "relative inline-flex items-center gap-1 rounded py-1 text-sm font-medium transition-colors duration-150 focus-ring",
          "after:absolute after:-bottom-1.5 after:left-0 after:right-0 after:h-0.5 after:rounded-full after:content-[''] after:transition-opacity after:duration-150",
          isActive
            ? "text-amber-50 after:bg-brand-400 after:opacity-100"
            : "text-amber-50/60 hover:text-amber-50 after:bg-brand-400 after:opacity-0",
        ].join(" ")}
      >
        {label}
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          className={["h-3.5 w-3.5 text-amber-50/40 transition-transform duration-150", isOpen ? "rotate-180" : ""].join(" ")}
        >
          <path d="M5 7.5l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {isOpen ? (
        <div
          role="menu"
          aria-label={label}
          className="dropdown-panel-enter absolute left-1/2 top-full z-50 mt-2 w-64 -translate-x-1/2 rounded-xl border border-white/10 bg-ink-800 p-1.5 shadow-xl shadow-black/40"
        >
          {items.map((item) => (
            <NavLink
              key={item.to}
              role="menuitem"
              to={item.to}
              onClick={onClose}
              className={({ isActive: childActive }) =>
                [
                  "block rounded-lg px-3 py-2 transition-colors duration-150 focus-ring",
                  childActive ? "bg-white/5 text-amber-50" : "text-amber-50/80 hover:bg-white/5 hover:text-amber-50",
                ].join(" ")
              }
            >
              <span className="block text-sm font-medium">{item.label}</span>
              {item.description ? <span className="mt-0.5 block text-xs text-amber-50/45">{item.description}</span> : null}
            </NavLink>
          ))}
        </div>
      ) : null}
    </div>
  );
}
