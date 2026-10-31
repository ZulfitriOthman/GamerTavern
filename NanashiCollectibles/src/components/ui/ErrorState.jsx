import Icon from "./Icon.jsx";
import Button from "./Button.jsx";

// One shared shape for every full-page error condition (404, 403, 500,
// offline/backend-unavailable) — a numeric/short code as oversized display
// type (same treatment NotFoundPage already used for "404"), an icon, a
// message, and an optional action. Distinct from EmptyState, which is for
// in-page "no data yet" conditions, not whole-page failures.
export default function ErrorState({ code, icon = "sparkle", title, description, action, className = "" }) {
  return (
    <div className={["flex flex-col items-center gap-4 py-10 text-center", className].join(" ")}>
      {code ? (
        <span className="font-display text-6xl font-semibold text-amber-50/15 sm:text-7xl">{code}</span>
      ) : (
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-brand-300">
          <Icon name={icon} className="h-6 w-6" />
        </span>
      )}
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-semibold text-amber-50">{title}</h1>
        {description ? <p className="max-w-md text-sm text-amber-50/60">{description}</p> : null}
      </div>
      {action}
      {!action && code ? <Button to="/">Back to home</Button> : null}
    </div>
  );
}
