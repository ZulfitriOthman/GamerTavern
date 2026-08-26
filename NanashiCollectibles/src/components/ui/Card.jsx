export default function Card({ as, className = "", children, ...props }) {
  const Tag = as || "div";

  return (
    <Tag
      className={[
        "rounded-2xl border border-white/10 bg-ink-800/60 p-6 backdrop-blur-sm",
        "transition-colors duration-150 hover:border-white/20",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </Tag>
  );
}
