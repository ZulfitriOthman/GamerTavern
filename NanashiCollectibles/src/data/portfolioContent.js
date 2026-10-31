// Non-project portfolio content (hero copy, about, skills, timeline, capability
// list) for src/pages/PortfolioPage.jsx. Kept separate from portfolioProjects.js
// so project data (which grows over time) doesn't crowd out this mostly-static
// copy. Sourced from the owner's own existing CV/portfolio (../Portfolio_Zulfitri) —
// no invented employers, dates, or qualifications.

export const portfolioProfile = {
  name: "Muhammad Zulfitri Bin Othman",
  headline: "Building practical digital solutions for real-world problems.",
  intro:
    "I work across software development, web applications, digital platforms, databases, integrations, and technology-driven projects — from customer-facing products to the databases and realtime services running underneath them.",
  cvUrl: "/Zulfitri-CV.pdf",
};

export const aboutMe = [
  "I'm a full-stack developer who builds things that have to actually work in production, not just in a demo. Over the past few years that's meant an events platform end to end, a cashless smart parking system used by real drivers and operators, and now NanashiCollectibles — a multi-vertical commerce and community platform built from the database up.",
  "Most of my time is spent moving between the frontend, the backend, and the database underneath both — React on one end, Node.js, Express, and Socket.IO in the middle, and Oracle or MySQL doing the actual bookkeeping. I like systems with real constraints: realtime state that has to stay in sync, payment and inventory flows that can't be wrong, and schemas that still make sense a year later.",
  "I'm not chasing every new framework — I'm interested in whatever actually gets a real problem solved cleanly, and I'm just as comfortable untangling a slow query as I am shipping a new feature.",
];

// Frontend/backend/database groups are things with direct evidence in shipped
// projects (see portfolioProjects.js). "Other Areas" is kept visually and
// textually distinct — self-declared direction, not claimed hands-on production
// experience — per the instruction to separate the two.
export const skillGroups = [
  {
    key: "frontend",
    label: "Frontend",
    icon: "layout",
    items: ["React.js", "JavaScript (ES6+)", "HTML5 & CSS3", "Tailwind CSS", "Responsive web design"],
  },
  {
    key: "backend",
    label: "Backend",
    icon: "code",
    items: ["Node.js", "Express", "Socket.IO (realtime)", "REST & realtime API integration"],
  },
  {
    key: "database",
    label: "Database & Data",
    icon: "database",
    items: ["Oracle Database", "MySQL / SQL", "Schema design & data modelling", "Python & ArcGIS (geospatial workflows)"],
  },
  {
    key: "tooling",
    label: "Development & Tooling",
    icon: "terminal",
    items: ["Git & version control", "Vite", "ESLint", "npm / package management"],
  },
];

export const otherAreas = {
  label: "Other Areas of Knowledge",
  caption: "Directions I'm building toward alongside day-to-day development work — not yet backed by shipped production projects the way the stack above is.",
  icon: "sparkle",
  items: ["Data Analytics", "Networking & IT Security", "System Design"],
};

// "kind: origin" renders slightly muted in ExperienceSection — real work
// history, just not a software role, kept for an honest journey rather than
// starting the timeline at a convenient point.
export const experienceTimeline = [
  {
    period: "2023 — Present",
    role: "Programmer / Developer",
    org: "360Geoinfo",
    description:
      "Building the B-JAUR platform and its admin systems, the Pintar Smart Parking platform (web, office portal, and mobile app), and working with realtime data and Oracle databases in production.",
    kind: "work",
  },
  {
    period: "2022 — 2023",
    role: "Developer",
    org: "Niat",
    description: "Built a vessel tracking system in Python and ArcGIS, working on geospatial data workflows and operational monitoring tools.",
    kind: "work",
  },
  {
    period: "2021 — 2022",
    role: "Supervisor",
    org: "Hajah Badariah Petrol Station",
    description: "Operations and customer-facing work — where the transition into software development began.",
    kind: "origin",
  },
];

export const educationTimeline = [
  { period: "2020", credential: "HND Computing", institution: "Micronet College" },
  { period: "2018", credential: "NCC Level 4 Diploma" },
  { period: "2014", credential: "GCE O Level" },
];

export const capabilities = [
  {
    key: "web-apps",
    icon: "layout",
    title: "Web Applications",
    description: "Modern responsive web applications designed around actual business requirements.",
  },
  {
    key: "business-systems",
    icon: "wrench",
    title: "Business Systems",
    description: "Internal platforms for managing workflows, users, data, operations, and reporting.",
  },
  {
    key: "ecommerce",
    icon: "cart",
    title: "E-Commerce Platforms",
    description: "Product catalogues, merchant systems, checkout flows, and commerce-related functionality.",
  },
  {
    key: "ticketing",
    icon: "ticket",
    title: "Event & Ticketing Systems",
    description: "Registration, ticketing, attendee management, and event workflows.",
  },
  {
    key: "integration",
    icon: "database",
    title: "API & Database Integration",
    description: "Connecting frontend applications with backend services, databases, and third-party systems.",
  },
  {
    key: "custom-software",
    icon: "code",
    title: "Custom Software",
    description: "Purpose-built digital tools for businesses with requirements generic software can't solve well.",
  },
];
