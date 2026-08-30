import { useRef } from "react";
import Card from "./Card.jsx";

// Adapted from preetsuthar17's Spotlight Card (21st.dev/@preetsuthar17/components/spotlight-card).
// The original tracks pointer position with useState, re-rendering the card on
// every mousemove — that's the exact pattern this project's performance rules
// forbid. Here the pointer position is written straight to CSS custom
// properties on the DOM node via a ref, so React never re-renders for pointer
// movement. Opacity is CSS-only (group-hover/group-focus-within), the spotlight
// color comes from the existing brand-500 token instead of the demo's hex, and
// this wraps the existing Card primitive as an overlay rather than replacing it.
export default function SpotlightCard({ as, variant = "interactive", className = "", children, ...props }) {
  const nodeRef = useRef(null);

  function handlePointerMove(event) {
    const node = nodeRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    node.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
    node.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
  }

  return (
    <Card
      ref={nodeRef}
      as={as}
      variant={variant}
      onPointerMove={handlePointerMove}
      className={["group/spotlight relative overflow-hidden", className].join(" ")}
      {...props}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/spotlight:opacity-100 group-focus-within/spotlight:opacity-100"
        style={{
          background:
            "radial-gradient(circle at var(--spot-x, 50%) var(--spot-y, 50%), rgba(108, 86, 232, 0.18), transparent 70%)",
        }}
      />
      {children}
    </Card>
  );
}
