// Small hand-drawn icon set for content (not nav) use — cards, stats, feature
// modules. Same technique as components/merchant/MerchantNavIcon.jsx (inline
// stroke paths, no icon library dependency), kept separate since that one is
// scoped to nav links and this set is homepage/content-wide.
const PATHS = {
  cart: "M4 5h2l1.5 10.5A2 2 0 009.5 17h7a2 2 0 002-1.7L20 8H7M9 21a1 1 0 100-2 1 1 0 000 2zm8 0a1 1 0 100-2 1 1 0 000 2z",
  trophy:
    "M8 4h8v5a4 4 0 01-8 0V4zM8 6H5a2 2 0 000 4h2M16 6h3a2 2 0 010 4h-2M10 15v3m4-3v3M8 21h8m-4-3v3",
  wrench:
    "M14.7 6.3a4 4 0 00-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 005.4-5.4l-2.6 2.6-2-2 2.6-2.6z",
  cards:
    "M7 3h10a2 2 0 012 2v10a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2zM5 8L3 9v10a2 2 0 002 2h10l2-1M9 8h6M9 12h6M9 16h4",
  drone:
    "M12 9a3 3 0 100 6 3 3 0 000-6zM5 6L9 10M19 6l-4 4M5 18l4-4M19 18l-4-4M4 5a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM17 5a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM4 19a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM17 19a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0z",
  code: "M9 8l-4 4 4 4M15 8l4 4-4 4M13 5l-2 14",
  layout:
    "M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1zM3 9h18M8 9v9",
  users:
    "M8 11a3 3 0 100-6 3 3 0 000 6zm8 0a3 3 0 100-6 3 3 0 000 6zM2 21c0-3.3 2.7-6 6-6s6 2.7 6 6M14 15.3c.6-.2 1.3-.3 2-.3 3.3 0 6 2.7 6 6",
  sparkle:
    "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3zM19 14l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2zM5 15l.5 1.5L7 17l-1.5.5L5 19l-.5-1.5L3 17l1.5-.5.5-1.5z",
  store:
    "M4 9l1-4h14l1 4M4 9v10a1 1 0 001 1h14a1 1 0 001-1V9M4 9h16M9 20v-5a1.5 1.5 0 013 0v5",
  scale:
    "M12 3v18M7 7h10M4 7l3-4 3 4-3 5-3-5zm10 0l3-4 3 4-3 5-3-5zM7 20h10",
  bolt: "M13 2L4 14h6l-1 8 9-12h-6l1-8z",
  heart:
    "M12 20.5s-7.5-4.6-10-9.3C.4 8 1.7 4.6 4.8 3.6c2-.6 4 .1 5.2 1.8.4.6 1.4.6 1.8 0 1.2-1.7 3.2-2.4 5.2-1.8 3.1 1 4.4 4.4 2.8 7.6-2.5 4.7-10 9.3-10 9.3z",
  star: "M12 3l2.6 5.6 6 .7-4.4 4.2 1.1 6-5.3-3-5.3 3 1.1-6L3.4 9.3l6-.7L12 3z",
  package:
    "M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8",
  check: "M5 12.5l4.5 4.5L19 7",
  chevronRight: "M8 5l7 7-7 7",
  minus: "M5 12h14",
  plus: "M12 5v14M5 12h14",
  truck:
    "M3 7h11v9H3V7zM14 10h4l3 3v3h-7v-6zM6.5 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm11 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z",
  newspaper:
    "M4 5h13a2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zM4 5a2 2 0 00-2 2v9a2 2 0 002 2M9 9h6M9 12h6M9 15h3",
  info: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 8h.01M12 11v5",
  trash: "M4 7h16M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3m-8 0v13a2 2 0 002 2h6a2 2 0 002-2V7M10 11v6M14 11v6",
  ticket:
    "M3 8a2 2 0 012-2h14a2 2 0 012 2v1a2 2 0 000 6v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1a2 2 0 000-6V8zM9 7v2M9 11.5v2M9 16v2",
  database:
    "M4 6c0-1.1 3.6-2 8-2s8 .9 8 2-3.6 2-8 2-8-.9-8-2zM4 6v6c0 1.1 3.6 2 8 2s8-.9 8-2V6M4 12v6c0 1.1 3.6 2 8 2s8-.9 8-2v-6",
  terminal: "M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1zM7 9l3 3-3 3M13 15h4",
};

export default function Icon({ name, className = "h-5 w-5", filled = false }) {
  const d = PATHS[name];
  if (!d) return null;
  return (
    <svg viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} className={className} aria-hidden="true">
      <path
        d={d}
        stroke="currentColor"
        strokeWidth={filled ? 0 : 1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
