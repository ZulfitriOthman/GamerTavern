const TONES = {
  neutral: "bg-white/5 text-amber-50/70 border-white/10",
  gold: "bg-gold-500/10 text-gold-300 border-gold-500/30",
  signal: "bg-signal-500/10 text-signal-400 border-signal-500/30",
  danger: "bg-danger-500/10 text-danger-400 border-danger-500/30",
};

export default function Badge({ tone = "neutral", className = "", children }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium tracking-wide",
        TONES[tone],
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}
