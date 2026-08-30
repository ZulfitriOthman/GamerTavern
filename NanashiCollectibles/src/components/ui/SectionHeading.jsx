// "page" is the top-of-page title role every other page still uses unchanged.
// "section" is the smaller subsection role — added so a single page (the homepage)
// can carry more than one heading level instead of every section reading as a
// page title.
const TITLE_SIZES = {
  page: "font-display text-3xl font-semibold text-amber-50 sm:text-4xl",
  section: "font-display text-xl font-semibold text-amber-50 sm:text-2xl",
};

export default function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  size = "page",
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
      <h2 className={TITLE_SIZES[size]}>{title}</h2>
      {description ? (
        <p className="text-base text-amber-50/70 sm:text-lg">{description}</p>
      ) : null}
    </div>
  );
}
