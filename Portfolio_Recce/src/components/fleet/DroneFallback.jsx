import { useEffect, useRef, useState } from "react";

// Pseudo-3D product presentation built from a real studio photo: pointer-driven
// tilt/parallax + a spotlight highlight + a soft depth shadow. No WebGL, no 3D
// model — see src/components/fleet/README.md for why, and what to swap in here
// if a real .glb becomes available later.
function DroneFallback({ image, imageAlt, hotspots = [], activeHotspot, onHotspotChange }) {
  const cardRef = useRef(null);
  const frameRef = useRef(null);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    reducedMotionRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const handlePointerMove = (event) => {
    if (reducedMotionRef.current || !cardRef.current) return;

    const rect = cardRef.current.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;

    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      if (!cardRef.current) return;
      const rotateY = (px - 0.5) * 16;
      const rotateX = (0.5 - py) * 16;
      cardRef.current.style.setProperty("--rx", `${rotateX}deg`);
      cardRef.current.style.setProperty("--ry", `${rotateY}deg`);
      cardRef.current.style.setProperty("--mx", `${px * 100}%`);
      cardRef.current.style.setProperty("--my", `${py * 100}%`);
    });
  };

  const resetTilt = () => {
    if (!cardRef.current) return;
    cardRef.current.style.setProperty("--rx", "0deg");
    cardRef.current.style.setProperty("--ry", "0deg");
  };

  return (
    <div className="mx-auto w-full max-w-md">
      <div
        ref={cardRef}
        onMouseMove={handlePointerMove}
        onMouseLeave={resetTilt}
        className="drone-tilt group relative aspect-square [perspective:900px]"
      >
        <div className="absolute inset-x-6 bottom-2 h-10 rounded-full bg-black/50 blur-2xl transition-opacity duration-300 group-hover:opacity-70" />

        <div className="drone-tilt-surface relative h-full w-full rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 shadow-panel">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10 rounded-3xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{
              background:
                "radial-gradient(circle at var(--mx, 50%) var(--my, 50%), rgba(39,210,255,0.16), transparent 45%)",
            }}
          />
          <img
            src={image}
            alt={imageAlt}
            className="h-full w-full rounded-3xl object-contain p-6"
            loading="lazy"
          />

          {hotspots.map((hotspot) => (
            <button
              key={hotspot.id}
              type="button"
              style={{ top: `${hotspot.top}%`, left: `${hotspot.left}%` }}
              className={`absolute z-20 grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-content-center rounded-full border transition ${
                activeHotspot === hotspot.id
                  ? "border-skyaccent bg-skyaccent text-slate-950"
                  : "border-skyaccent/60 bg-slate-950/70 text-skyaccent hover:border-skyaccent"
              }`}
              onMouseEnter={() => onHotspotChange(hotspot.id)}
              onFocus={() => onHotspotChange(hotspot.id)}
              onClick={() => onHotspotChange(activeHotspot === hotspot.id ? null : hotspot.id)}
              aria-pressed={activeHotspot === hotspot.id}
              aria-label={hotspot.label}
            >
              <span className="h-2 w-2 rounded-full bg-current" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default DroneFallback;
