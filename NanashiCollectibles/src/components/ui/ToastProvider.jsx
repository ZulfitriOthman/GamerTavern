import { useCallback, useMemo, useRef, useState } from "react";
import { ToastContext } from "./ToastContext.js";

const TONES = {
  success: "border-signal-500/30 bg-ink-800 text-amber-50",
  error: "border-danger-500/40 bg-ink-800 text-amber-50",
  info: "border-white/10 bg-ink-800 text-amber-50",
};

const ICON = {
  success: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0 text-signal-400" aria-hidden="true">
      <path d="M4 10.5l3.5 3.5L16 5.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0 text-danger-400" aria-hidden="true">
      <path d="M10 6v5m0 3h.01M4 10a6 6 0 1112 0 6 6 0 01-12 0z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  info: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0 text-amber-50/60" aria-hidden="true">
      <path d="M10 9v5m0-8h.01M4 10a6 6 0 1112 0 6 6 0 01-12 0z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

const AUTO_DISMISS_MS = 4000;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    ({ tone = "info", message }) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, tone, message }]);
      window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss]
  );

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:right-4 sm:left-auto"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={[
              "pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border px-4 py-3 text-sm shadow-xl shadow-black/30 backdrop-blur-sm",
              TONES[toast.tone],
            ].join(" ")}
          >
            {ICON[toast.tone]}
            <span className="flex-1">{toast.message}</span>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
              className="rounded text-amber-50/40 hover:text-amber-50/70 focus-ring"
            >
              <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
