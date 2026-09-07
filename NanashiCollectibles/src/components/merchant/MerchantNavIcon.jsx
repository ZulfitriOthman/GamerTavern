// Small hand-drawn icon set, matching the inline-SVG convention already used
// throughout the app (Header.jsx, Field.jsx) rather than pulling in an icon library.
const PATHS = {
  grid: "M4 5h6v6H4V5zm10 0h6v6h-6V5zM4 15h6v6H4v-6zm10 0h6v6h-6v-6z",
  box: "M3 8l9-5 9 5-9 5-9-5zm0 0v9l9 5m0-14v14m9-14v9l-9 5",
  stack: "M4 8l8-4 8 4-8 4-8-4zm0 5l8 4 8-4M4 8l8 4 8-4",
  cart: "M4 5h2l1.5 10.5A2 2 0 009.5 17h7a2 2 0 002-1.7L20 8H7M9 21a1 1 0 100-2 1 1 0 000 2zm8 0a1 1 0 100-2 1 1 0 000 2z",
  people: "M8 11a3 3 0 100-6 3 3 0 000 6zm8 0a3 3 0 100-6 3 3 0 000 6zM2 21c0-3.3 2.7-6 6-6s6 2.7 6 6M14 15.3c.6-.2 1.3-.3 2-.3 3.3 0 6 2.7 6 6",
  coin: "M12 21a9 9 0 100-18 9 9 0 000 18zm0-13v8m-3-2c0 1.1 1.3 2 3 2s3-.9 3-2-1.3-1.5-3-2-3-.9-3-2 1.3-2 3-2 3 .9 3 2",
  gear: "M12 15a3 3 0 100-6 3 3 0 000 6zm8.4-3a7.4 7.4 0 01-.1 1.2l2 1.5-2 3.4-2.3-.9a7.4 7.4 0 01-2 1.2L15.5 21h-4l-.5-2.6a7.4 7.4 0 01-2-1.2l-2.3.9-2-3.4 2-1.5A7.4 7.4 0 013.6 12a7.4 7.4 0 01.1-1.2l-2-1.5 2-3.4 2.3.9a7.4 7.4 0 012-1.2L8.5 3h4l.5 2.6a7.4 7.4 0 012 1.2l2.3-.9 2 3.4-2 1.5c.07.4.1.8.1 1.2z",
};

export default function MerchantNavIcon({ name, className = "h-5 w-5" }) {
  const d = PATHS[name];
  if (!d) return null;
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d={d} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
