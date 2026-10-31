import SectionHeading from "../ui/SectionHeading.jsx";
import ProductCard from "./ProductCard.jsx";
import { Skeleton } from "../ui/Skeleton.jsx";

// Backed by products.featured (a real, vendor-set flag — see the "Feature this
// product" checkbox in components/merchant/ProductForm.jsx), never fabricated. Only
// rendered by ShopPage when there's at least one featured product and no active
// search/category/price/availability filter, so it never duplicates the main grid's
// content under a filtered view.
export default function FeaturedRail({ status, items }) {
  if (status !== "loading" && items.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <SectionHeading eyebrow="Handpicked" title="Featured Products" size="section" />
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        {status === "loading"
          ? Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="aspect-square w-44 shrink-0 sm:w-52" aria-hidden="true" />
            ))
          : items.map((product) => (
              <ProductCard key={product.id} product={product} className="w-44 shrink-0 sm:w-52" />
            ))}
      </div>
    </div>
  );
}
