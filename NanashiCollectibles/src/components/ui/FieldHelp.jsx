import { useEffect, useId, useRef, useState } from "react";
import Icon from "./Icon.jsx";

// A small "toggletip" for a short explanation next to a field label — unlike
// a CSS-only :hover tooltip, this also opens on keyboard focus and on tap,
// since touch devices can't hover. Reusable anywhere a label needs a brief
// explanation without cluttering the hint text under the field.
//
// Opening is additive only (hover-as-mouse, focus, click all set it true) so
// there's no toggle race with the synthetic mouse/focus events some mobile
// browsers fire around a tap. Closing happens on outside pointerdown,
// Escape, blur, or mouse-leave — never by tapping the icon a second time.
export default function FieldHelp({ label, children }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const tooltipId = useId();

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <span ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={tooltipId}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") setOpen(true);
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") setOpen(false);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(true)}
        className={[
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-colors duration-150 focus-ring",
          open ? "text-signal-400" : "text-amber-50/40 hover:text-signal-400",
        ].join(" ")}
      >
        <Icon name="info" className="h-3.5 w-3.5" />
      </button>

      <span
        role="tooltip"
        id={tooltipId}
        className={[
          "absolute left-0 top-full z-50 mt-2 w-64 max-w-[calc(100vw-3rem)] rounded-lg border border-white/10 bg-ink-800 p-3 text-xs leading-relaxed text-amber-50/75 shadow-xl shadow-black/40 transition-opacity duration-150",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
      >
        {children}
      </span>
    </span>
  );
}
