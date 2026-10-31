import { useApiResource } from "../merchant/useApiResource.js";
import { listProductReviews } from "./reviewsService.js";

export function useProductReviews(productId) {
  const { status, data, error, refresh } = useApiResource(
    () => listProductReviews(productId),
    [productId],
    { enabled: Boolean(productId) }
  );

  return {
    status,
    reviews: data?.items || [],
    summary: data?.summary || { count: 0, average: 0 },
    error,
    refresh,
  };
}
