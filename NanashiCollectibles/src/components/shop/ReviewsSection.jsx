import Icon from "../ui/Icon.jsx";
import Badge from "../ui/Badge.jsx";
import EmptyState from "../ui/EmptyState.jsx";
import { SkeletonText } from "../ui/Skeleton.jsx";
import { useProductReviews } from "../../features/shop/useProductReviews.js";

function Stars({ value, size = "h-4 w-4" }) {
  return (
    <div className="flex items-center gap-0.5" aria-hidden="true">
      {Array.from({ length: 5 }, (_, i) => (
        <Icon key={i} name="star" filled={i < Math.round(value)} className={[size, i < Math.round(value) ? "text-gold-400" : "text-white/15"].join(" ")} />
      ))}
    </div>
  );
}

export default function ReviewsSection({ productId }) {
  const { status, reviews, summary } = useProductReviews(productId);

  return (
    <div className="flex flex-col gap-6">
      {summary.count > 0 ? (
        <div className="flex items-center gap-4">
          <Stars value={summary.average} size="h-5 w-5" />
          <p className="text-sm text-amber-50/70">
            {summary.average.toFixed(1)} out of 5 · {summary.count} review{summary.count === 1 ? "" : "s"}
          </p>
        </div>
      ) : null}

      {status === "loading" ? (
        <SkeletonText lines={4} />
      ) : reviews.length === 0 ? (
        <EmptyState title="No reviews yet" description="Be the first to review this product after purchasing it." />
      ) : (
        <div className="flex flex-col divide-y divide-white/5">
          {reviews.map((review) => (
            <div key={review.id} className="flex flex-col gap-2 py-4 first:pt-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <Stars value={review.rating} />
                <span className="text-sm font-medium text-amber-50/85">{review.reviewer_name}</span>
                {review.verified_purchase ? (
                  <Badge tone="signal" className="text-[10px]">
                    Verified Purchase
                  </Badge>
                ) : null}
                <span className="text-xs text-amber-50/40">
                  {new Date(review.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
                </span>
              </div>
              {review.title ? <p className="text-sm font-medium text-amber-50/90">{review.title}</p> : null}
              {review.body ? <p className="text-sm text-amber-50/65">{review.body}</p> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
