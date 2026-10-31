// Sidebar/drawer nav config for the admin shell. Deliberately just the two
// sections that exist today — see CLAUDE.md guidance against empty
// placeholder modules. Add entries here as real admin features ship.
export const ADMIN_NAV = [
  { to: "/admin/dashboard", label: "Dashboard", icon: "grid" },
  { to: "/admin/merchants", label: "Merchants", icon: "people" },
  { to: "/admin/audit-log", label: "Audit Log", icon: "clock" },
];
