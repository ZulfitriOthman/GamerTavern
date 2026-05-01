export function formatDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export function toMonthKey(iso) {
  return iso.slice(0, 7); // YYYY-MM
}

export function formatMonth(key) {
  const [y, m] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, 1);
  return dt.toLocaleDateString(undefined, { year: "numeric", month: "long" });
}

export function pad2(n) {
  return String(n).padStart(2, "0");
}

export function buildGoogleCalendarLink({
  title,
  date,
  startTime,
  endTime,
  location,
  details,
}) {
  const [y, m, d] = date.split("-").map(Number);
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);

  const start = new Date(y, m - 1, d, sh, sm, 0);
  const end = new Date(y, m - 1, d, eh, em, 0);

  const toGCal = (dt) => {
    const yyyy = dt.getUTCFullYear();
    const mm = pad2(dt.getUTCMonth() + 1);
    const dd = pad2(dt.getUTCDate());
    const hh = pad2(dt.getUTCHours());
    const mi = pad2(dt.getUTCMinutes());
    const ss = pad2(dt.getUTCSeconds());
    return `${yyyy}${mm}${dd}T${hh}${mi}${ss}Z`;
  };

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${toGCal(start)}/${toGCal(end)}`,
    location: location || "",
    details: details || "",
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function formatMoney(n) {
  if (n == null || Number.isNaN(Number(n))) return "-";
  return `BND ${Number(n).toFixed(2)}`;
}
