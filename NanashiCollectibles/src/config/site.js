export const site = {
  name: "NanashiCollectibles",
  tagline: "Collect. Create. Compete. Build.",
  description:
    "A multi-purpose platform for trading card games, collectibles and hobby products, drone and software development services, and RVS esports tournaments.",
};

// Header.jsx's primary customer-facing navigation — kept to top-level
// destinations rather than one item per page, per the navbar redesign
// (2026-09-16). TCG and RVS Esports moved from two permanent top-level items
// into one "Explore" category; Services already had children, just gained
// short descriptions to match. "Portfolio" (added 2026-09-27) is the site
// owner's personal portfolio, a plain link with no children like "Shop"/
// "About". `to` on a dropdown parent is used only for active-route matching
// (see Header.jsx isParentActive) — "Explore" has no landing page of its
// own, so its trigger is a toggle button, not a link; "Services" does have
// one (/services) so its own route still counts toward its active state.
export const primaryNav = [
  { label: "Shop", to: "/shop" },
  {
    label: "Explore",
    children: [
      { label: "TCG", to: "/tcg", description: "Trading cards, games and community" },
      { label: "RVS Esports", to: "/esports", description: "Tournaments and competitive gaming" },
    ],
  },
  {
    label: "Services",
    to: "/services",
    children: [
      { label: "Drone Services", to: "/services/drone", description: "Aerial and FPV work" },
      { label: "Website Development", to: "/services/web-development", description: "Business and product websites" },
      { label: "Application Development", to: "/services/application-development", description: "Custom digital systems" },
      { label: "Ticketing Service", to: "/services/ticketing", description: "Event ticketing, seating, registration, and booking" },
    ],
  },
  { label: "Portfolio", to: "/portfolio" },
  { label: "About", to: "/about" },
];

// Secondary/utility navigation — visually separate from primaryNav (right-
// side utility zone in Header.jsx), never mixed into the primary cluster.
export const utilityNav = [{ label: "Merchant Portal", to: "/merchant" }];

export const footerNav = [
  {
    heading: "Shop",
    links: [
      { label: "Trading Card Games", to: "/shop" },
      { label: "Collectibles & Gunpla", to: "/shop" },
      { label: "Drone & Computer Parts", to: "/shop" },
    ],
  },
  {
    heading: "Services",
    links: [
      { label: "Drone Services", to: "/services/drone" },
      { label: "Website Development", to: "/services/web-development" },
      { label: "Application Development", to: "/services/application-development" },
      { label: "Ticketing Service", to: "/services/ticketing" },
    ],
  },
  {
    heading: "Community",
    links: [
      { label: "Trading Card Games", to: "/tcg" },
      { label: "RVS Esports", to: "/esports" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", to: "/about" },
      { label: "Portfolio", to: "/portfolio" },
      { label: "Contact", to: "/contact" },
    ],
  },
];

export const businessPillars = [
  {
    key: "shop",
    name: "Shop",
    summary:
      "Trading card games, accessories, collectibles, Gunpla, and drone & computer parts.",
    to: "/shop",
  },
  {
    key: "services",
    name: "Professional Services",
    summary: "Drone, website, and application development for real businesses.",
    to: "/services",
  },
  {
    key: "tcg",
    name: "TCG Community",
    summary: "A hub for the games our community actually plays and trades.",
    to: "/tcg",
  },
  {
    key: "esports",
    name: "RVS Esports",
    summary: "Tournament registration and results, starting with Apex Legends.",
    to: "/esports",
  },
];

export const shopCategories = [
  {
    name: "Trading Card Games",
    description: "Digimon, Pokémon, Magic: The Gathering, Vanguard, Ultraman, and more.",
  },
  {
    name: "TCG Accessories",
    description: "Sleeves, deck boxes, binders, storage, and play accessories.",
  },
  {
    name: "Collectibles",
    description: "Curated collectible items across franchises.",
  },
  {
    name: "Gunpla",
    description: "Gunpla kits, model kits, and hobby accessories.",
  },
  {
    name: "Drone Parts",
    description: "Spare parts, FPV components, batteries, and propellers.",
  },
  {
    name: "Computer Parts",
    description: "Components, peripherals, and replacement parts.",
  },
];

export const services = [
  {
    key: "drone",
    name: "Drone Services",
    to: "/services/drone",
    summary: "Aerial photography, videography, and event coverage.",
    examples: [
      "Aerial photography & videography",
      "Drone event coverage",
      "Promotional drone footage",
      "Location & property footage",
      "Custom drone projects",
    ],
  },
  {
    key: "web-development",
    name: "Website Development",
    to: "/services/web-development",
    summary: "Business, ecommerce, and event websites.",
    examples: [
      "Business & corporate websites",
      "Ecommerce websites",
      "Event websites",
      "Registration systems",
      "Custom web applications",
    ],
  },
  {
    key: "application-development",
    name: "Application Development",
    to: "/services/application-development",
    summary: "Web applications and internal business systems.",
    examples: [
      "Web applications",
      "Internal business systems",
      "Management systems",
      "Registration systems",
      "Dashboards",
    ],
  },
  {
    key: "ticketing",
    name: "Ticketing Service",
    to: "/services/ticketing",
    summary: "Registration, ticket sales, seating, and capacity management for real events.",
    // No SERVICES table row exists for this yet (unlike drone/web-dev/app-dev),
    // so ServiceDetailPage skips the direct QuotationForm (which requires a
    // real backend service id to attach an enquiry to) and shows a /contact
    // CTA instead — see ServiceDetailPage.jsx.
    quotable: false,
    // Honest status labels: the ticketing backend (Database/schema/009_ticketing.sql,
    // Backend/services/ticketing/, Backend/routes/api/ticketing.routes.js) has real
    // inventory/hold-session logic, but no customer-facing purchase flow exists yet
    // (no /events pages) and no payment/order/check-in wiring — unlabeled items are
    // the ones with genuine backend support today; the rest are explicitly planned.
    examples: [
      "Reserved seating & general admission",
      "Ticket categories & pricing tiers",
      "Live capacity & availability tracking",
      "Booking holds during checkout",
      "Online ticket sales (in development)",
      "Interactive seat selection (planned)",
      "Payment integration (planned)",
      "QR / digital tickets & event check-in (planned)",
    ],
    audience: [
      "Concerts",
      "Conventions",
      "Esports tournaments",
      "Exhibitions",
      "Workshops",
      "Private events",
      "Community events",
      "Seated performances",
    ],
  },
];

// The real, honest engagement process — used on both the Services landing and
// each service detail page. Not backend-driven; describes how enquiries
// currently work (see ContactPage / enquiries:create).
export const serviceProcess = [
  {
    step: "1. Enquire",
    description: "Tell us what you need through Contact — a project, an event, or an internal system.",
  },
  {
    step: "2. Quotation",
    description: "We follow up with a scoped quotation based on what you're trying to build.",
  },
  {
    step: "3. Delivery",
    description: "Work happens as a real project — drone, website, or application — not a shop checkout.",
  },
];

export const tcgGames = [
  "Digimon Card Game",
  "Pokémon Trading Card Game",
  "Magic: The Gathering",
  "Cardfight!! Vanguard",
  "Ultraman Card Game",
];
