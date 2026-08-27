import { Link } from "react-router-dom";
import Spinner from "./Spinner.jsx";

const VARIANTS = {
  primary: "bg-brand-500 text-white hover:bg-brand-400 shadow-lg shadow-brand-600/20",
  secondary:
    "bg-ink-800 text-amber-50 border border-white/10 hover:border-white/20 hover:bg-ink-700",
  ghost: "text-amber-50/80 hover:text-amber-50",
  danger: "bg-transparent border border-danger-500/40 text-danger-400 hover:bg-danger-500/10",
  // Visual-only — a link-styled CTA still renders as <Link>/<a>/<button> below,
  // exactly like every other variant. No padding/background of its own.
  link: "bg-transparent p-0 text-brand-400 hover:text-brand-300 underline-offset-4 hover:underline",
};

const SIZES = {
  sm: "px-4 py-2 text-sm",
  md: "px-5 py-2.5 text-sm",
  lg: "px-6 py-3.5 text-base",
};

export default function Button({
  to,
  href,
  variant = "primary",
  size = "md",
  isLoading = false,
  disabled = false,
  className = "",
  children,
  ...props
}) {
  const isLink = variant === "link";
  const isDisabled = disabled || isLoading;

  const classes = [
    "inline-flex items-center justify-center gap-2 font-medium transition-colors duration-150 focus-ring",
    isLink ? "rounded" : "rounded-lg",
    VARIANTS[variant],
    isLink ? "" : SIZES[size],
    isDisabled ? "pointer-events-none opacity-60" : "",
    className,
  ].join(" ");

  const content = (
    <>
      {isLoading ? <Spinner size="sm" /> : null}
      {children}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={classes} aria-disabled={isDisabled || undefined} {...props}>
        {content}
      </Link>
    );
  }

  if (href) {
    return (
      <a href={href} className={classes} aria-disabled={isDisabled || undefined} {...props}>
        {content}
      </a>
    );
  }

  return (
    <button type="button" className={classes} disabled={isDisabled} {...props}>
      {content}
    </button>
  );
}
