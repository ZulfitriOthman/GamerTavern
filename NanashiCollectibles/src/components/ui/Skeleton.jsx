export function Skeleton({ className = "" }) {
  return <div className={["animate-pulse rounded-md bg-white/5", className].join(" ")} aria-hidden="true" />;
}

export function SkeletonText({ lines = 1, className = "" }) {
  return (
    <div className={["flex flex-col gap-2", className].join(" ")} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={["h-3", i === lines - 1 && lines > 1 ? "w-2/3" : "w-full"].join(" ")} />
      ))}
    </div>
  );
}

// Approximates the shape shared by TournamentCard/service/category cards — a title
// row with a badge, a couple of description lines, then a metadata grid — so
// swapping this in for real content later doesn't cause layout shift.
export function SkeletonCard({ className = "" }) {
  return (
    <div
      className={["rounded-xl border border-white/10 bg-ink-800/60 p-6", className].join(" ")}
      aria-hidden="true"
    >
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <SkeletonText lines={2} className="mt-3" />
      <div className="mt-4 grid grid-cols-2 gap-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    </div>
  );
}
