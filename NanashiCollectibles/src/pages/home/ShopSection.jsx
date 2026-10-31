import { useEffect, useState } from "react";
import Section from "../../components/layout/Section.jsx";
import SectionHeading from "../../components/ui/SectionHeading.jsx";
import Button from "../../components/ui/Button.jsx";
import BlurFade from "../../components/ui/BlurFade.jsx";
import { Skeleton } from "../../components/ui/Skeleton.jsx";
import ProductCard from "../../components/shop/ProductCard.jsx";
import CategoryTile from "./CategoryTile.jsx";
import { useShopCategories } from "../../features/shop/useShopCategories.js";
import { useSocket } from "../../services/socket/SocketContext.js";
import { listShopProducts } from "../../features/shop/shopService.js";

// Small, homepage-local featured strip — separate from components/shop/
// FeaturedRail.jsx (that one is ShopPage-specific: it only renders when no
// filter is active there). Same underlying contract (products.featured, a
// real vendor-set flag), same "render nothing if empty" rule — never padded
// with placeholder cards.
function useFeaturedProducts(limit = 4) {
  const { socket, status: socketStatus } = useSocket();
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    if (!socket || socketStatus !== "connected") return undefined;
    let cancelled = false;
    listShopProducts(socket, { featured: true, limit })
      .then((data) => {
        if (cancelled) return;
        setItems(data?.items || []);
        setStatus("success");
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [socket, socketStatus, limit]);

  return { items, status };
}

export default function ShopSection() {
  const { categories, status: categoriesStatus } = useShopCategories();
  const { items: featured, status: featuredStatus } = useFeaturedProducts(4);
  const showFeatured = featuredStatus === "success" && featured.length > 0;

  const [first, ...rest] = categories;

  return (
    <Section spacing="md" containerSize="xwide">
      <div className="grid gap-10 lg:grid-cols-[0.65fr_1.35fr] lg:items-start">
        <div className="flex flex-col gap-4">
          <BlurFade inView>
            <SectionHeading
              size="section"
              eyebrow="Shop"
              title="Trading cards, collectibles, and technology"
              description="Real storefront categories, pulled directly from the catalog — not a static list."
            />
          </BlurFade>
          <Button to="/shop" variant="secondary" className="w-fit">
            Browse the shop
          </Button>
        </div>

        <div className="flex flex-col gap-3">
          {categoriesStatus === "loading" ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-40 rounded-xl" />
              ))}
            </div>
          ) : categories.length === 0 ? (
            <Skeleton className="h-40 rounded-xl" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              {first ? (
                <div className="sm:col-span-2">
                  <CategoryTile category={first} large />
                </div>
              ) : null}
              {rest.slice(0, 5).map((category) => (
                <CategoryTile key={category.id} category={category} />
              ))}
            </div>
          )}
        </div>
      </div>

      {showFeatured ? (
        <div className="mt-10 flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-50/45">Featured products</p>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} className="w-48 shrink-0 sm:w-56" />
            ))}
          </div>
        </div>
      ) : null}
    </Section>
  );
}
