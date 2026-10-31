// Backend/controllers/product.controller.js stores image_url as a backend-relative
// path (e.g. "/public/uploads/products/xyz.jpg" — see image:upload in that file), not
// a full URL. Same API_BASE convention already used by authService.js/merchantApi.js.
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3002";

// Generic — despite this file's name, nothing here is actually product-
// specific beyond the URL convention (a backend-relative path needing
// API_BASE prepended). Reused for any other backend-relative upload path,
// e.g. delivery reference photos (see DeliveryReferencePhotoUpload.jsx),
// rather than duplicating this one-liner in a second file.
export function resolveUploadUrl(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_BASE}${url.startsWith("/") ? "" : "/"}${url}`;
}

export function resolveProductImageUrl(url) {
  return resolveUploadUrl(url);
}

// product_images is ordered is_primary DESC, sort_order ASC by the backend already —
// images[0] is always the right one to show in a listing card.
export function getPrimaryImageUrl(product) {
  return resolveProductImageUrl(product?.images?.[0]?.image_url);
}

// Trading Card Games product types whose imagery is a physical card and
// therefore benefits from a true portrait frame (~5:7, an actual TCG
// card's ratio) with the full artwork visible, rather than the general
// object-cover treatment every other category/product type uses. Matched
// by SLUG (category_slug/product_type_slug on the public product
// response), never by display name — a merchant/admin renaming "Single
// Card" or "Trading Card Games" must not silently change this. Shared by
// ProductCard.jsx (shop grid) and ProductGallery.jsx (product detail
// page) so the two can never disagree about which products get portrait
// treatment. Extend this set if another TCG product type's imagery also
// turns out to benefit from portrait — everything else in Trading Card
// Games (Booster Box, Bundle, ...) keeps the general treatment, since box/
// pack photography is typically not portrait-shaped.
const PORTRAIT_CARD_PRODUCT_TYPE_SLUGS = new Set(["single-card"]);

export function usesPortraitCardImage(product) {
  return product?.category_slug === "trading-card-games" && PORTRAIT_CARD_PRODUCT_TYPE_SLUGS.has(product?.product_type_slug);
}
