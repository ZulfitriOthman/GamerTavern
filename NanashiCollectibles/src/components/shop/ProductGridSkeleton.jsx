import { Skeleton } from "../ui/Skeleton.jsx";

// Mirrors ProductCard's actual anatomy (aspect-square image, eyebrow, title, merchant
// line, price row) so swapping in real content causes no layout shift — same intent as
// components/ui/Skeleton.jsx's SkeletonCard, sized for the shop grid instead.
function ProductCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-ink-800/60" aria-hidden="true">
      <Skeleton className="aspect-square w-full" />
      <div className="flex flex-col gap-2 p-3.5">
        <Skeleton className="h-2.5 w-1/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="mt-2 h-5 w-2/5" />
      </div>
    </div>
  );
}

export default function ProductGridSkeleton({ count = 8 }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4" role="status" aria-label="Loading products">
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
