import { Link } from "react-router-dom";

const VARIANTS = {
  primary:
    "bg-brand-500 text-white hover:bg-brand-400 shadow-lg shadow-brand-600/20",
  secondary:
    "bg-ink-800 text-amber-50 border border-white/10 hover:border-white/20 hover:bg-ink-700",
  ghost: "text-amber-50/80 hover:text-amber-50",
};

const SIZES = {
  md: "px-5 py-2.5 text-sm",
  lg: "px-6 py-3.5 text-base",
};

export default function Button({
  to,
  href,
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}) {
  const classes = [
    "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors duration-150",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400",
    VARIANTS[variant],
    SIZES[size],
    className,
  ].join(" ");

  if (to) {
    return (
      <Link to={to} className={classes} {...props}>
        {children}
      </Link>
    );
  }

  if (href) {
    return (
      <a href={href} className={classes} {...props}>
        {children}
      </a>
    );
  }

  return (
    <button type="button" className={classes} {...props}>
      {children}
    </button>
  );
}
