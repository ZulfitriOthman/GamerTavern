import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import Badge from "../ui/Badge.jsx";
import WishlistButton from "./WishlistButton.jsx";
import { formatMoney } from "../../features/shop/format.js";
import { getPrimaryImageUrl, usesPortraitCardImage } from "../../features/shop/productImage.js";

const NEW_WINDOW_DAYS = 14;

function isRecentlyListed(createdAt) {
  if (!createdAt) return false;
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return false;
  return Date.now() - created <= NEW_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

// Now a real <Link> to /shop/:slug (the product-detail page built alongside
// this — see the Stage 3 report). The wishlist heart lives inside the image
// area, revealed on hover/focus rather than always-on, so the resting card
// stays clean; it stops event propagation so tapping it never triggers the
// card's own navigation.
export default function ProductCard({ product, className = "" }) {
  const nodeRef = useRef(null);
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = getPrimaryImageUrl(product);
  const showImage = imageUrl && !imageFailed;
  const isPortraitCard = usesPortraitCardImage(product);

  const outOfStock = product.stock_quantity <= 0;
  const lowStock =
    !outOfStock &&
    product.low_stock_threshold != null &&
    product.stock_quantity <= product.low_stock_threshold;
  const productIsNew = isRecentlyListed(product.created_at);
  const merchantLabel = product.merchant_name || product.seller_name;

  // Pointer position is written straight to a CSS custom property on the DOM node
  // (not React state) so hovering never triggers a re-render — same technique as
  // components/ui/SpotlightCard.jsx (adapted from 21st.dev/@preetsuthar17/components/
  // spotlight-card), reused here directly since that component's fixed Card padding
  // can't host an edge-to-edge product image.
  function handlePointerMove(event) {
    const node = nodeRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    node.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
    node.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
  }

  const imageContent = showImage ? (
    <img
      src={imageUrl}
      alt={product.name}
      loading="lazy"
      decoding="async"
      onError={() => setImageFailed(true)}
      className={[
        "h-full w-full transition-transform duration-300 group-hover:scale-[1.04]",
        isPortraitCard ? "object-contain" : "object-cover",
      ].join(" ")}
    />
  ) : (
    <div className="flex h-full w-full items-center justify-center">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-10 w-10 text-amber-50/15">
        <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="8.5" cy="9.5" r="1.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M21 16l-5.5-5.5a2 2 0 00-2.8 0L4 19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );

  return (
    <Link
      to={`/shop/${product.slug}`}
      ref={nodeRef}
      onPointerMove={handlePointerMove}
      className={[
        "group relative flex flex-col overflow-hidden rounded-xl border border-white/10 bg-ink-800/60 backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 focus-ring",
        className,
      ].join(" ")}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(circle at var(--spot-x, 50%) var(--spot-y, 50%), rgba(108, 86, 232, 0.14), transparent 70%)",
        }}
      />

      <div
        className={[
          "relative w-full shrink-0 overflow-hidden bg-ink-900",
          isPortraitCard ? "aspect-[5/7] p-3" : "aspect-square",
        ].join(" ")}
      >
        {/* Portrait TCG cards get their own inner rounded-corner frame around
            the artwork itself (slightly softer than the outer card's own
            rounded-xl) — the padding above already insets the card art from
            the container edge, so without this the artwork's own corners
            read as sharp/square inside that inset. Non-portrait products are
            untouched — the image already runs edge-to-edge and shares the
            outer container's rounding via its own overflow-hidden. */}
        {isPortraitCard ? <div className="h-full w-full overflow-hidden rounded-xl">{imageContent}</div> : imageContent}

        {productIsNew ? (
          <div className="absolute left-2 top-2 z-20">
            <Badge tone="signal" className="px-2 py-0.5 text-[10px]">
              New
            </Badge>
          </div>
        ) : null}

        {outOfStock ? (
          <div className="absolute right-2 top-2 z-20">
            <Badge tone="danger" className="px-2 py-0.5 text-[10px]">
              Out of stock
            </Badge>
          </div>
        ) : lowStock ? (
          <div className="absolute right-2 top-2 z-20">
            <Badge tone="gold" className="px-2 py-0.5 text-[10px]">
              Low stock
            </Badge>
          </div>
        ) : null}

        <div className="absolute bottom-2 right-2 z-20 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
          <WishlistButton productId={product.id} size="sm" />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3.5">
        {product.category_name ? (
          <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-amber-50/40">
            {product.category_name}
            {product.product_type_name ? ` · ${product.product_type_name.toUpperCase()}` : ""}
          </p>
        ) : null}

        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-amber-50">{product.name}</h3>

        {merchantLabel ? <p className="truncate text-xs text-amber-50/50">by {merchantLabel}</p> : null}

        <div className="mt-auto flex items-end justify-between gap-2 pt-2.5">
          <p className="font-display text-base font-semibold text-amber-50">{formatMoney(product.price)}</p>
          {product.condition_label ? (
            <span className="shrink-0 truncate rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-amber-50/55">
              {product.condition_label}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
