import { useRef, useState } from "react";

// Lightweight, dependency-free zoom/pan wrapper (CSS transform + Pointer Events —
// Pointer Events already unify mouse/touch/pen, so no separate touch handling is
// needed). No existing zoom/pan implementation was found in the project (framer-motion
// is installed but unused per CLAUDE.md, and isn't justified for this — plain CSS
// transforms are sufficient), so this is a new, generic, reusable primitive rather
// than something one-off to the seating demo.
export default function ZoomPanViewport({ children, className = "", minScale = 1, maxScale = 3 }) {
  const [scale, setScale] = useState(minScale);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef(null);

  function clampScale(next) {
    return Math.min(maxScale, Math.max(minScale, +next.toFixed(2)));
  }

  function zoomBy(delta) {
    setScale((prev) => {
      const next = clampScale(prev + delta);
      if (next === minScale) setTranslate({ x: 0, y: 0 });
      return next;
    });
  }

  function reset() {
    setScale(minScale);
    setTranslate({ x: 0, y: 0 });
  }

  function handlePointerDown(event) {
    if (scale <= minScale) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { startX: event.clientX, startY: event.clientY, startTranslate: translate };
    setIsDragging(true);
  }

  function handlePointerMove(event) {
    if (!dragRef.current) return;
    const { startX, startY, startTranslate } = dragRef.current;
    setTranslate({ x: startTranslate.x + (event.clientX - startX), y: startTranslate.y + (event.clientY - startY) });
  }

  function endDrag() {
    dragRef.current = null;
    setIsDragging(false);
  }

  const canPan = scale > minScale;

  return (
    <div className="relative">
      <div className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-lg border border-white/10 bg-ink-900/90 p-1 shadow-lg backdrop-blur">
        <button type="button" onClick={() => zoomBy(-0.5)} disabled={scale <= minScale} aria-label="Zoom out" className="flex h-7 w-7 items-center justify-center rounded text-sm text-amber-50/70 transition-colors duration-150 hover:text-amber-50 disabled:opacity-30 focus-ring">
          −
        </button>
        <button type="button" onClick={reset} aria-label="Reset zoom" className="flex h-7 items-center justify-center rounded px-2 text-[11px] font-medium text-amber-50/70 transition-colors duration-150 hover:text-amber-50 focus-ring">
          Reset
        </button>
        <button type="button" onClick={() => zoomBy(0.5)} disabled={scale >= maxScale} aria-label="Zoom in" className="flex h-7 w-7 items-center justify-center rounded text-sm text-amber-50/70 transition-colors duration-150 hover:text-amber-50 disabled:opacity-30 focus-ring">
          +
        </button>
      </div>

      <div
        className={["overflow-hidden rounded-xl border border-white/10 bg-ink-950/60", canPan ? (isDragging ? "cursor-grabbing" : "cursor-grab") : "", className].join(" ")}
        style={{ touchAction: canPan ? "none" : "pan-y" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={() => !dragRef.current || endDrag()}
      >
        <div
          className={["flex h-full w-full items-start justify-center p-4", isDragging ? "" : "transition-transform duration-150"].join(" ")}
          style={{ transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`, transformOrigin: "center top" }}
        >
          {children}
        </div>
      </div>

      {canPan ? <p className="mt-2 text-center text-[11px] text-amber-50/35">Drag to pan</p> : null}
    </div>
  );
}
