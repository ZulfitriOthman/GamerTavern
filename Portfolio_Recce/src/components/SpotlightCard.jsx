import { useRef } from "react";

// A cursor-following highlight on hover, implemented as plain CSS custom
// properties + a radial-gradient overlay — no animation library. Pattern
// referenced from 21st.dev's "Spotlight Card" / "Card Spotlight" components
// (preetsuthar17, manuarora700) and reimplemented dependency-free to match
// this project's zero-runtime-dependency Tailwind setup.
function SpotlightCard({ as: Tag = "div", className = "", children, ...rest }) {
  const ref = useRef(null);

  const handleMouseMove = (event) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    ref.current.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
    ref.current.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
  };

  return (
    <Tag
      ref={ref}
      onMouseMove={handleMouseMove}
      className={`group relative overflow-hidden ${className}`}
      {...rest}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(220px circle at var(--spot-x, 50%) var(--spot-y, 50%), rgba(39,210,255,0.14), transparent 70%)",
        }}
      />
      <div className="relative z-10">{children}</div>
    </Tag>
  );
}

export default SpotlightCard;
