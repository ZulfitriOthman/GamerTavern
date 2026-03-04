// payments.js
const ENV_API_BASE =
  String(import.meta.env.VITE_API_BASE || "").trim() ||
  String(import.meta.env.VITE_API_URL || "").trim();

const VITE_API_BASE =
  ENV_API_BASE ||
  (typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "http://localhost:3001"
    : window.location.origin);

export async function checkoutPayment(payload) {
  const endpoint = `${VITE_API_BASE}/api/payments/checkout`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(
        "Payment route not found on server. Deploy backend changes and ensure POST /api/payments/checkout exists.",
      );
    }
    throw new Error(data?.details || data?.message || "Payment failed");
  }

  return data;
}
