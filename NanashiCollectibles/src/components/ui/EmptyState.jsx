export default function EmptyState({ title, description, action, className = "" }) {
  return (
    <div
      className={[
        "flex flex-col items-start gap-2 rounded-xl border border-dashed border-white/10 p-6",
        className,
      ].join(" ")}
    >
      <p className="text-sm font-medium text-amber-50/80">{title}</p>
      {description ? <p className="text-sm text-amber-50/55">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
