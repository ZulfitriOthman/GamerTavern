export function formatDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { dateStyle: "medium" });
}

export function formatDateTime(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

// Backend/controllers/tournament.controller.js's own broadcast email formats entry fees
// as "BND X.XX" — matching that convention rather than inventing a currency.
export function formatEntryFee(value) {
  if (value == null || value === "") return "Free";
  const n = Number(value);
  if (!Number.isFinite(n)) return "Free";
  return n === 0 ? "Free" : `BND ${n.toFixed(2)}`;
}
