import { useEffect, useRef } from "react";

// Minimal accessible dialog: traps focus, closes on Escape/overlay click, restores
// focus to the trigger on close. No animation library — a CSS transition, already
// neutralized by the app-wide prefers-reduced-motion override in index.css.
const SIZES = {
  md: "max-w-md",
  xl: "max-w-5xl",
};

export default function Modal({ open, onClose, title, children, footer, size = "md" }) {
  const dialogRef = useRef(null);
  const previouslyFocused = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    previouslyFocused.current = document.activeElement;
    const dialog = dialogRef.current;
    const focusable = dialog?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusable?.[0]?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={["modal-in relative flex max-h-[90vh] w-full flex-col rounded-xl border border-white/10 bg-ink-800 p-6 shadow-2xl shadow-black/50", SIZES[size] || SIZES.md].join(" ")}
      >
        {title ? <h2 className="font-display text-lg font-semibold text-amber-50">{title}</h2> : null}
        <div className={["min-h-0 overflow-y-auto", title ? "mt-4" : ""].join(" ")}>{children}</div>
        {footer ? <div className="mt-6 flex justify-end gap-3">{footer}</div> : null}
      </div>
    </div>
  );
}
