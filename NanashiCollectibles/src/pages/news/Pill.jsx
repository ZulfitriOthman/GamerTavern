export function Pill({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-amber-700/40 bg-slate-950/40 px-3 py-1 text-xs font-serif tracking-wide text-amber-200">
      {children}
    </span>
  );
}

export function ButtonGhost({ active, children, ...props }) {
  return (
    <button
      {...props}
      className={[
        "rounded-full px-4 py-2 text-sm font-serif transition-all",
        "border border-amber-700/30 bg-slate-950/30 hover:bg-slate-950/50",
        active
          ? "text-amber-200 shadow-[0_0_0_1px_rgba(245,158,11,0.35)]"
          : "text-amber-100/80",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export function GamePill({ game }) {
  const cls =
    game === "Magic"
      ? "border-amber-700/50 bg-amber-950/40 text-amber-200"
      : game === "Yu-Gi-Oh"
      ? "border-purple-700/50 bg-purple-950/40 text-purple-100"
      : game === "Pokemon"
      ? "border-emerald-700/50 bg-emerald-950/30 text-emerald-100"
      : game === "Vanguard"
      ? "border-sky-700/50 bg-sky-950/30 text-sky-100"
      : "border-amber-700/40 bg-slate-950/40 text-amber-200";

  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-serif tracking-wide",
        cls,
      ].join(" ")}
    >
      {game}
    </span>
  );
}
