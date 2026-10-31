// Portfolio project data for Muhammad Zulfitri Bin Othman's personal portfolio
// (src/pages/PortfolioPage.jsx, src/pages/PortfolioProjectPage.jsx). Every entry
// here describes real, delivered work — either this NanashiCollectibles platform
// itself, or projects documented in the owner's own existing portfolio/CV
// (../Portfolio_Zulfitri). No fabricated metrics, clients, or GitHub links —
// `links.github` is left undefined everywhere because none are evidenced.
//
// Add a future project by appending to `portfolioProjects` — ProjectGrid's
// category filter and CurrentlyBuilding both derive from this array, so no
// other file needs to change.

export const PROJECT_STATUS = {
  LIVE: { label: "Live", tone: "signal" },
  IN_DEVELOPMENT: { label: "In Development", tone: "gold" },
  PROTOTYPE: { label: "Prototype", tone: "neutral" },
  CONCEPT: { label: "Concept", tone: "neutral" },
};

export const portfolioCategories = [
  { key: "platforms", label: "Platforms" },
  { key: "esports", label: "Esports" },
  { key: "web", label: "Web Development" },
  { key: "applications", label: "Applications" },
];

export const portfolioProjects = [
  {
    slug: "nanashicollectibles",
    name: "NanashiCollectibles",
    category: "platforms",
    status: "IN_DEVELOPMENT",
    currentlyBuilding: true,
    icon: "package",
    shortDescription:
      "A multi-vertical commerce and community platform — shop, multi-merchant marketplace, TCG community, professional services, and RVS Esports tournaments, all on one shared account system.",
    stack: ["React", "Tailwind CSS", "Node.js", "Express", "Socket.IO", "MySQL"],
    links: { live: "/" },
    role: "Sole developer — frontend architecture, backend controllers, database schema, and the checkout/payment abstraction.",
    detail: {
      overview:
        "NanashiCollectibles is the platform you're looking at right now — a multi-vertical commerce and community platform built to support several different business lines under one roof: a TCG and collectibles shop, a multi-merchant marketplace, professional services (web/app/drone development), and RVS Esports tournaments.",
      problem:
        "Nanashi's business isn't one store — it spans trading cards, collectibles, drone and web development services, and esports tournaments. Building each of those as its own disconnected site would mean duplicated logins, duplicated payment flows, and no shared foundation for the next vertical.",
      solution:
        "One React frontend and Express/Socket.IO backend sitting on a single MySQL schema, where every vertical shares the same authentication, authorization, and realtime layer instead of reinventing it. New verticals (like the marketplace and ticketing layers) are added as extensions of that shared contract, not parallel systems.",
      myRole:
        "Sole developer across the stack — frontend architecture and design system, backend REST/Socket.IO contracts, database schema design, and the multi-merchant checkout/payment abstraction.",
      features: [
        "Multi-merchant marketplace with commission tracking and payouts",
        "Real-time tournament registration and results via Socket.IO",
        "Role-based authentication and authorization (customer, merchant, admin)",
        "Checkout with idempotency handling and a pluggable payment provider abstraction",
        "Product catalogue with variants, categories, and per-TCG-game filtering",
      ],
      challenges:
        "Keeping every vertical consistent — the same auth, the same design system, the same database conventions — while still shipping one module at a time rather than building everything simultaneously.",
      outcome:
        "RVS Esports tournament registration is the first fully live vertical. The marketplace backend and database schema are code-complete and reviewed, and are being verified against a real MySQL instance as each piece goes live.",
    },
  },
  {
    slug: "rvs-esports",
    name: "RVS Esports Tournament System",
    category: "esports",
    status: "LIVE",
    icon: "trophy",
    shortDescription:
      "Real-time tournament registration for individual and team competitions, with live capacity, participant, and team updates pushed over Socket.IO.",
    stack: ["React", "Socket.IO", "Node.js", "Express", "MySQL", "JWT"],
    links: { live: "/esports" },
    role: "Sole developer — registration flow, realtime events, and backend transaction logic.",
    detail: {
      overview:
        "The first fully live vertical on NanashiCollectibles — lets players register for tournaments individually or as a team, with capacity, participants, and results updating live for everyone watching.",
      problem:
        "Tournament registration has to handle two very different shapes — a single player entry, or a full team with a captain and teammates — without hard-coding a specific game or team size, and without registration numbers going stale the moment someone else joins.",
      solution:
        "A registration_type-driven schema (individual vs team) with atomic team creation — team, captain registration, teammate registrations, and membership links all happen inside one database transaction, so a failure can't leave a half-created team behind. Socket.IO pushes tournament:created/updated/participants_updated/teams_updated events so every connected client sees changes live.",
      myRole: "Sole developer — registration flow, realtime events, and backend transaction logic.",
      features: [
        "Individual and team registration on the same schema",
        "Atomic team creation with captain assignment",
        "Live participant/team/capacity updates over Socket.IO",
        "Authenticated and guest teammate entries, with captain-only identity claims",
        "Leave/withdraw flows scoped to the caller's own registration, their team as captain, or admin override",
      ],
      challenges:
        "Capacity and duplicate-registration checks currently happen before the write, which is a known race condition under concurrent registrations — documented as open technical debt rather than treated as solved. The fix path is row locking or a transactional re-check.",
      outcome:
        "This is the most complete frontend-to-backend vertical on the platform today, and the reference implementation the other verticals followed for authentication and realtime conventions.",
    },
  },
  {
    slug: "bjaur",
    name: "B-jaur.com",
    category: "web",
    status: "LIVE",
    icon: "layout",
    shortDescription:
      "An events discovery platform — one place to find upcoming activities and events happening during holidays.",
    stack: ["React.js", "Node.js", "Express", "Socket.IO"],
    links: { live: "https://b-jaur.com" },
    role: "Full-stack development.",
    detail: {
      overview:
        "B-jaur.com helps people discover upcoming activities and events happening during holidays, all in one place.",
      problem:
        "Event information for holidays and local activities tends to be scattered across different pages and sources, with no single place to browse what's actually happening.",
      solution:
        "A React frontend backed by a Node/Express API, with Socket.IO used for the parts of the site that need to update live rather than on a page refresh.",
      myRole: "Full-stack development on the public platform.",
      features: [
        "Event browsing and discovery",
        "Real-time updates via Socket.IO",
        "A companion management portal for content and operations",
      ],
      challenges:
        "Structuring the platform so the public site and the internal management portal (a separate, related project) could share the same underlying data cleanly.",
      outcome: "Live in production at b-jaur.com.",
    },
  },
  {
    slug: "bjaur-management-portal",
    name: "B-jaur Management Portal",
    category: "applications",
    status: "LIVE",
    icon: "layout",
    shortDescription:
      "The operational side of B-jaur — content handling, admin workflows, and management controls for the platform.",
    stack: ["React.js", "Node.js", "Express"],
    links: { live: "https://management.b-jaur.com/" },
    role: "Contributed to building the management portal for operational controls, content handling, and admin workflows.",
    detail: {
      overview:
        "The internal counterpart to B-jaur.com — an admin portal for the people running the platform day to day, rather than the public visitors browsing it.",
      problem: "Running the public B-jaur platform needs real operational tooling — content upkeep, admin actions — separate from the public-facing site.",
      solution: "A dedicated React/Node admin portal, built alongside the public platform and reading from the same underlying data.",
      myRole: "Contributed to building the management portal for operational controls, content handling, and admin workflows.",
      features: [
        "Content management for the public B-jaur platform",
        "Administrative workflow tools",
        "Operational controls for platform staff",
      ],
      outcome: "Live in production, used to operate the B-jaur platform.",
    },
  },
  {
    slug: "pintar-smart-parking",
    name: "Pintar Smart Parking",
    category: "web",
    status: "LIVE",
    icon: "cart",
    shortDescription:
      "Connects drivers with parking operators for cashless, digital ticket payment — no cash needed.",
    stack: ["React.js", "Node.js", "Express", "Socket.IO", "Oracle Database"],
    links: { live: "https://pintarsmartparking.com" },
    role: "Web platform development, plus ongoing Oracle database maintenance for parking sessions, users, and transactions.",
    detail: {
      overview:
        "Pintar Smart Parking lets drivers pay for parking digitally instead of handling cash, connecting them directly with parking operators.",
      problem: "Cash-based parking payment is slow and operationally messy for both drivers and operators.",
      solution:
        "A web platform plus a companion office portal and native mobile app, all backed by an Oracle database handling parking sessions, users, and transactions in real time.",
      myRole:
        "Web platform development, plus ongoing Oracle Database 23ai maintenance — schema and indexing work to keep operational queries responsive, and controlled updates to production data structures as the platform evolved.",
      features: [
        "Cashless digital ticket payment",
        "Real-time session status via Socket.IO",
        "Companion office portal and native mobile app",
      ],
      challenges:
        "Keeping parking session state consistent in real time across the web platform, office portal, and mobile app, all reading from the same live database.",
      outcome: "Live in production, used by real drivers and parking operators.",
    },
  },
  {
    slug: "pintar-office-portal",
    name: "Pintar Smart Parking — Office Portal",
    category: "applications",
    status: "LIVE",
    icon: "layout",
    shortDescription: "The operations-side portal for Pintar Smart Parking — office-side parking management, monitoring, and administrative workflows.",
    stack: ["React.js", "Node.js", "Express"],
    links: { live: "https://office.pintarsmartparking.com/" },
    role: "Built the operations portal for office-side parking management, monitoring, and administrative workflows.",
    detail: {
      overview: "The internal operations portal for Pintar Smart Parking, giving office staff visibility and control over parking operations.",
      problem: "Operating a parking network needs monitoring and administrative tooling distinct from what drivers see on the public app.",
      solution: "A dedicated React/Node office portal reading from the same Oracle-backed parking data as the public platform.",
      myRole: "Built the operations portal for office-side parking management, monitoring, and administrative workflows.",
      features: ["Parking session monitoring", "Administrative workflows for office staff", "Operational reporting on parking activity"],
      outcome: "Live in production, used for day-to-day parking operations.",
    },
  },
  {
    slug: "pintar-mobile-app",
    name: "Pintar Smart Parking — Mobile App",
    category: "applications",
    status: "LIVE",
    icon: "bolt",
    shortDescription: "iOS and Android app for cashless parking — scan, pay, extend, and track parking sessions on the go.",
    stack: ["React Native", "Expo"],
    links: {
      appStore: "https://apps.apple.com/us/app/pintar-smart-parking-app/id6749289069",
      playStore: "https://play.google.com/store/apps/details?id=com.pintarsmartparking.bsb",
    },
    image: "https://pintarsmartparking.com/assets/CTA%20Phone%20Mockup-CLj9j0HE.png",
    role: "Mobile app development (React Native / Expo).",
    detail: {
      overview: "The mobile counterpart to Pintar Smart Parking — cashless parking from a phone, published on both major app stores.",
      problem: "Drivers need a fast way to pay for and manage parking sessions without carrying cash or using a separate kiosk.",
      solution: "A React Native app built with Expo, talking to the same backend and Oracle database as the web platform and office portal.",
      myRole: "Mobile app development (React Native / Expo).",
      features: [
        "Scan-to-pay parking sessions",
        "Session extension and tracking",
        "Published on the App Store and Google Play",
      ],
      outcome: "Live on iOS and Android.",
    },
  },
  {
    slug: "vessel-tracking-system",
    name: "Vessel Tracking System",
    category: "applications",
    status: "LIVE",
    icon: "scale",
    shortDescription: "A geospatial vessel tracking system built in Python and ArcGIS to monitor movement and support operational decisions.",
    stack: ["Python", "ArcGIS"],
    links: {},
    role: "Developer — built the tracking workflows and geospatial data handling.",
    detail: {
      overview: "A vessel tracking system built for Niat, using Python and ArcGIS to monitor vessel movement and support operational visibility.",
      problem: "Operators needed better visibility into vessel movement and position to support day-to-day operational decisions.",
      solution: "Python-based workflows feeding into ArcGIS for mapping and geospatial analysis of vessel positions over time.",
      myRole: "Developer — built the tracking workflows and geospatial data handling.",
      features: ["Vessel movement monitoring", "Geospatial data workflows in Python", "Map-based analysis and visualization in ArcGIS"],
      outcome: "Delivered as part of geospatial development work at Niat (2022–2023).",
    },
  },
  {
    slug: "ticketing-platform",
    name: "Ticketing Platform",
    category: "applications",
    status: "PROTOTYPE",
    icon: "ticket",
    shortDescription:
      "An in-progress event ticketing system for NanashiCollectibles — reserved seating, general admission, ticket categories, and live capacity tracking.",
    stack: ["Node.js", "Express", "MySQL"],
    links: {},
    role: "Backend design — schema, inventory logic, and booking-hold sessions.",
    detail: {
      overview:
        "A ticketing backbone being built for NanashiCollectibles events — concerts, conventions, esports tournaments — beyond a simple shop checkout.",
      problem:
        "Nanashi needed real ticketing infrastructure for events, not just product checkout: reserved seats, admission tiers, and capacity that stays accurate under concurrent bookings.",
      solution:
        "A dedicated ticketing schema and backend service handling ticket categories, pricing tiers, and booking holds during checkout — built first as backend infrastructure, ahead of any customer-facing purchase flow.",
      myRole: "Backend design — schema, inventory logic, and booking-hold sessions.",
      features: [
        "Reserved seating and general admission modelling",
        "Ticket categories and pricing tiers",
        "Live capacity and availability tracking",
        "Booking holds during checkout",
      ],
      challenges:
        "The backend inventory and hold-session logic is real, but there's no customer-facing purchase flow yet — no public events pages, and no payment, order, or check-in wiring.",
      outcome: "Backend prototype — genuinely functional inventory logic, honestly not yet a finished product.",
    },
  },
];

export function getProjectBySlug(slug) {
  return portfolioProjects.find((project) => project.slug === slug) || null;
}
