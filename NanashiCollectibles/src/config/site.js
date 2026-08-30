export const site = {
  name: "NanashiCollectibles",
  tagline: "Collect. Create. Compete. Build.",
  description:
    "A multi-purpose platform for trading card games, collectibles and hobby products, drone and software development services, and RVS esports tournaments.",
};

export const primaryNav = [
  { label: "Shop", to: "/shop" },
  {
    label: "Services",
    to: "/services",
    children: [
      { label: "Drone Services", to: "/services/drone" },
      { label: "Website Development", to: "/services/web-development" },
      { label: "Application Development", to: "/services/application-development" },
    ],
  },
  { label: "TCG", to: "/tcg" },
  { label: "RVS Esports", to: "/esports" },
  { label: "About", to: "/about" },
];

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
