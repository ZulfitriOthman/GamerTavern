export default function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  className = "",
}) {
  const alignment = align === "center" ? "text-center items-center mx-auto" : "text-left items-start";

  return (
    <div className={["flex max-w-2xl flex-col gap-3", alignment, className].join(" ")}>
      {eyebrow ? (
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-signal-400">
          {eyebrow}
        </span>
      ) : null}
      <h2 className="font-display text-3xl font-semibold text-amber-50 sm:text-4xl">{title}</h2>
      {description ? (
        <p className="text-base text-amber-50/70 sm:text-lg">{description}</p>
      ) : null}
    </div>
  );
}
