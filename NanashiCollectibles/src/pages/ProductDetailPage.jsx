import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import Section from "../components/layout/Section.jsx";
import Breadcrumb from "../components/ui/Breadcrumb.jsx";
import Badge from "../components/ui/Badge.jsx";
import Button from "../components/ui/Button.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import Icon from "../components/ui/Icon.jsx";
import { Skeleton, SkeletonText } from "../components/ui/Skeleton.jsx";
import { useToast } from "../components/ui/ToastContext.js";
import ProductGallery from "../components/shop/ProductGallery.jsx";
import QuantityStepper from "../components/shop/QuantityStepper.jsx";
import WishlistButton from "../components/shop/WishlistButton.jsx";
import ReviewsSection from "../components/shop/ReviewsSection.jsx";
import RelatedProducts from "../components/shop/RelatedProducts.jsx";
import { useProduct } from "../features/shop/useProduct.js";
import { formatMoney } from "../features/shop/format.js";
import { usesPortraitCardImage } from "../features/shop/productImage.js";
import { useCart } from "../features/cart/CartContext.js";

export default function ProductDetailPage() {
  const { slug } = useParams();
  const { status, product } = useProduct(slug);
  const { addItem } = useCart();
  const { push } = useToast();
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);

  if (status === "loading") {
    return (
      <Section spacing="lg" containerSize="xwide" className="pt-14 sm:pt-20">
        <div className="grid gap-10 lg:grid-cols-2">
          <Skeleton className="aspect-square w-full rounded-xl" />
          <div className="flex flex-col gap-4">
            <SkeletonText lines={6} />
          </div>
        </div>
      </Section>
    );
  }

  if (status === "error" || !product) {
    return (
      <Section spacing="lg" containerSize="wide" className="pt-14 sm:pt-20">
        <ErrorState
          icon="sparkle"
          title="Product not found"
          description="This product may have been removed or is no longer available."
          action={<Button to="/shop">Back to shop</Button>}
        />
      </Section>
    );
  }

  const outOfStock = product.stock_quantity <= 0;
  const lowStock = !outOfStock && product.low_stock_threshold != null && product.stock_quantity <= product.low_stock_threshold;
  const merchantLabel = product.merchant_name || product.seller_name;

  async function handleAddToCart() {
    setAdding(true);
    try {
      await addItem(product.id, null, quantity);
      push({
        tone: "success",
        message: (
          <>
            {product.name} added to cart.{" "}
            <Link to="/cart" className="font-medium underline underline-offset-2">
              View Cart
            </Link>
          </>
        ),
      });
    } catch (err) {
      push({ tone: "error", message: err.message });
    } finally {
      setAdding(false);
    }
  }

  return (
    <Section spacing="lg" containerSize="xwide" className="pb-24 pt-14 sm:pt-20">
      <Breadcrumb
        items={[
          { label: "Shop", to: "/shop" },
          ...(product.category_name ? [{ label: product.category_name, to: `/shop?category=${product.category_id}` }] : []),
          { label: product.name },
        ]}
        className="mb-6"
      />

      <div className="grid gap-10 lg:grid-cols-2">
        <ProductGallery images={product.images} productName={product.name} portrait={usesPortraitCardImage(product)} />

        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            {product.category_name ? <Badge>{product.category_name}</Badge> : null}
            {product.tcg_game_name ? <Badge tone="gold">{product.tcg_game_name}</Badge> : null}
          </div>

          <h1 className="font-display text-2xl font-semibold text-amber-50 sm:text-3xl">{product.name}</h1>

          <p className="font-display text-3xl font-semibold text-amber-50">{formatMoney(product.price)}</p>

          <div className="flex flex-wrap items-center gap-2">
            {outOfStock ? (
              <Badge tone="danger">Out of stock</Badge>
            ) : lowStock ? (
              <Badge tone="gold">Low stock — {product.stock_quantity} left</Badge>
            ) : (
              <Badge tone="signal">In stock</Badge>
            )}
            {product.condition_label ? <Badge tone="neutral">{product.condition_label}</Badge> : null}
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 border-y border-white/10 py-4 text-sm">
            {merchantLabel ? (
              <div>
                <dt className="text-xs uppercase tracking-wide text-amber-50/40">Sold by</dt>
                <dd className="mt-0.5 text-amber-50/80">{merchantLabel}</dd>
              </div>
            ) : null}
            {product.code ? (
              <div>
                <dt className="text-xs uppercase tracking-wide text-amber-50/40">SKU</dt>
                <dd className="mt-0.5 text-amber-50/80">{product.code}</dd>
              </div>
            ) : null}
            {product.brand ? (
              <div>
                <dt className="text-xs uppercase tracking-wide text-amber-50/40">Brand</dt>
                <dd className="mt-0.5 text-amber-50/80">{product.brand}</dd>
              </div>
            ) : null}
          </dl>

          {!outOfStock ? (
            <div className="flex items-center gap-3">
              <QuantityStepper value={quantity} onChange={setQuantity} max={product.stock_quantity} />
              <span className="text-xs text-amber-50/45">{product.stock_quantity} available</span>
            </div>
          ) : null}

          <div className="flex items-center gap-3">
            <Button size="lg" onClick={handleAddToCart} disabled={outOfStock} isLoading={adding} className="flex-1 sm:flex-none">
              {outOfStock ? "Out of stock" : "Add to Cart"}
            </Button>
            <WishlistButton productId={product.id} size="md" />
          </div>

          <div className="flex items-center gap-2 text-xs text-amber-50/45">
            <Icon name="truck" className="h-4 w-4" />
            Delivery and pickup arranged with the merchant after checkout.
          </div>
        </div>
      </div>

      <div className="mt-14 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-semibold text-amber-50">Description</h2>
          {product.description ? (
            <p className="whitespace-pre-line text-sm leading-relaxed text-amber-50/70">{product.description}</p>
          ) : product.short_description ? (
            <p className="text-sm leading-relaxed text-amber-50/70">{product.short_description}</p>
          ) : (
            <p className="text-sm text-amber-50/45">No description provided for this product.</p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-semibold text-amber-50">Details</h2>
          <dl className="flex flex-col divide-y divide-white/5 text-sm">
            {[
              ["Category", product.category_name],
              ["TCG Game", product.tcg_game_name],
              ["Condition", product.condition_label],
              ["Brand", product.brand],
            ]
              .filter(([, value]) => value)
              .map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 py-2">
                  <dt className="text-amber-50/45">{label}</dt>
                  <dd className="text-right text-amber-50/80">{value}</dd>
                </div>
              ))}
          </dl>
        </div>
      </div>

      <div className="mt-14">
        <h2 className="mb-5 font-display text-lg font-semibold text-amber-50">Reviews</h2>
        <ReviewsSection productId={product.id} />
      </div>

      <div className="mt-14">
        <RelatedProducts product={product} />
      </div>
    </Section>
  );
}
