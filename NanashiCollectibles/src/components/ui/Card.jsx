import { forwardRef } from "react";

// Card controls visual treatment only (surface/border/padding/radius/elevation/
// interaction) — never layout width. Pages/containers own max-width and position.
const VARIANTS = {
  default: "border-white/10 bg-ink-800/60",
  // Hover lift/border and the focus ring are opt-in via variant="interactive" only,
  // so static cards never accidentally look clickable.
  interactive:
    "border-white/10 bg-ink-800/60 hover:border-white/20 hover:-translate-y-0.5 cursor-pointer focus-ring",
  elevated: "border-white/15 bg-ink-800 shadow-xl shadow-black/30",
  form: "border-white/10 bg-ink-800/60",
  data: "border-white/10 bg-ink-800/60",
};

const PADDING = {
  default: "p-6",
  interactive: "p-6",
  elevated: "p-6",
  form: "p-6 sm:p-8",
  data: "p-5",
};

const Card = forwardRef(function Card(
  { as, variant = "default", className = "", children, ...props },
  ref
) {
  const Tag = as || "div";

  return (
    <Tag
      ref={ref}
      className={[
        "rounded-xl border transition-colors duration-150",
        variant !== "elevated" ? "backdrop-blur-sm" : "",
        variant === "interactive" ? "transition-transform" : "",
        VARIANTS[variant],
        PADDING[variant],
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </Tag>
  );
});

export default Card;
