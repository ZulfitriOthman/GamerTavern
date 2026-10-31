// src/features/checkout/addressFormat.js — shared address display helpers.
// Consumed by CheckoutPage's Contact/Address card, the address selector
// modal, OrderConfirmationPage, and the merchant order detail page — one
// place for "how does a CUSTOMER_ADDRESSES-shaped object become text" so
// the four don't drift into contradictory formatting.
//
// Never renders a blank line for a NULL/empty column (ADDRESS_LINE2 and
// MUKIM are frequently empty) — every helper here filters falsy parts out
// rather than joining fixed-position fields.

const COUNTRY_NAMES = {
  BN: "Brunei Darussalam",
};

export function formatCountryName(code) {
  if (!code) return "";
  return COUNTRY_NAMES[code] || code;
}

// Multi-line display, e.g.:
//   No. 10, Jalan Example
//   Kampong Example
//   Mukim Berakas
//   Brunei-Muara · BBXXXX
// Returns an array of non-blank lines — render each as its own row.
export function formatAddressLines(address) {
  if (!address) return [];
  const line1 = [address.addressLine1, address.addressLine2].filter(Boolean).join(", ");
  const districtPostcode = [address.district, address.postcode].filter(Boolean).join(" · ");
  return [line1, address.village, address.mukim, districtPostcode].filter(Boolean);
}

// Single-line, comma-joined — for compact contexts (address list previews,
// radio option labels) where a multi-line block doesn't fit.
export function formatAddressInline(address) {
  if (!address) return "";
  return [address.addressLine1, address.addressLine2, address.village, address.mukim, address.district, address.postcode]
    .filter(Boolean)
    .join(", ");
}
