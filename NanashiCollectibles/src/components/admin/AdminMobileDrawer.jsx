import { useEffect } from "react";
import { Link } from "react-router-dom";
import AdminNavLinks from "./AdminNavLinks.jsx";

// A dedicated drawer, not the desktop sidebar squeezed smaller — mirrors
// MerchantMobileDrawer.jsx's pattern. Closes on Escape and on navigation.
export default function AdminMobileDrawer({ open, onClose, userName }) {
  useEffect(() => {
    if (!open) return undefined;
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] lg:hidden">
      <div className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Admin navigation"
        className="drawer-in relative flex h-full w-72 max-w-[85vw] flex-col border-r border-white/10 bg-ink-900"
      >
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
          <Link to="/admin/dashboard" onClick={onClose} className="rounded font-display text-base font-semibold text-amber-50 focus-ring">
            Nanashi<span className="text-brand-400">Admin</span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-amber-50/60 hover:text-amber-50 focus-ring"
          >
            <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="border-b border-white/10 px-5 py-4">
          <p className="truncate text-sm font-medium text-amber-50/85">{userName}</p>
          <p className="text-xs text-amber-50/45">Administrator</p>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <AdminNavLinks onNavigate={onClose} />
        </div>
      </div>
    </div>
  );
}
