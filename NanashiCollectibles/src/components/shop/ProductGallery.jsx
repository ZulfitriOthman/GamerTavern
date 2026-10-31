import { useState } from "react";
import { resolveProductImageUrl } from "../../features/shop/productImage.js";

// Same "no image" glyph as ProductCard.jsx's own fallback — kept as identical
// inline markup rather than a shared Icon entry, since Icon.jsx's one-path
// renderer can't express this multi-shape icon without added complexity for
// a glyph used in exactly these two places.
function NoImage({ className = "h-12 w-12" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8.5" cy="9.5" r="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M21 16l-5.5-5.5a2 2 0 00-2.8 0L4 19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// `images`: PRODUCT_IMAGES rows, already primary-first/sort_order-ordered by
// the backend (see productImage.js). No thumbnail rail at all when there's
// only one image (or none) — an empty/single-item rail is exactly the "broken
// empty thumbnail section" the brief calls out.
//
// `portrait`: true for Trading Card Games Single Card products (see
// usesPortraitCardImage() in productImage.js) — shows the full card in its
// native ~5:7 ratio via object-contain instead of the general square/
// object-cover treatment, which would crop the top/bottom of the card art.
export default function ProductGallery({ images = [], productName, portrait = false }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex];
  const activeUrl = active ? resolveProductImageUrl(active.image_url) : null;

  return (
    <div className="flex flex-col gap-3">
      <div
        className={[
          "relative w-full overflow-hidden rounded-xl border border-white/10 bg-ink-900",
          portrait ? "aspect-[5/7] max-w-sm p-4" : "aspect-square",
        ].join(" ")}
      >
        {activeUrl ? (
          <img
            src={activeUrl}
            alt={productName}
            className={["h-full w-full", portrait ? "object-contain" : "object-cover"].join(" ")}
            loading="eager"
            decoding="async"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-amber-50/15">
            <NoImage />
          </div>
        )}
      </div>

      {images.length > 1 ? (
        <div className="flex gap-2.5 overflow-x-auto pb-1" role="tablist" aria-label="Product images">
          {images.map((image, i) => (
            <button
              key={image.id || i}
              type="button"
              role="tab"
              aria-selected={i === activeIndex}
              aria-label={`Image ${i + 1} of ${images.length}`}
              onClick={() => setActiveIndex(i)}
              className={[
                "h-16 w-16 shrink-0 overflow-hidden rounded-lg border transition-colors duration-150 focus-ring",
                i === activeIndex ? "border-brand-400" : "border-white/10 hover:border-white/25",
              ].join(" ")}
            >
              <img
                src={resolveProductImageUrl(image.image_url)}
                alt=""
                aria-hidden="true"
                className={["h-full w-full", portrait ? "object-contain" : "object-cover"].join(" ")}
                loading="lazy"
                decoding="async"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
