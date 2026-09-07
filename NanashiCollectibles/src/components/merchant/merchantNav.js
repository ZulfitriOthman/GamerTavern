// Sidebar/drawer nav config, gated by the same roles the backend enforces
// (Backend/modules/restAuth.module.js requireMerchant minRole). This is convenience
// only — hiding a link never substitutes for the backend's own check.
const ALL_ROLES = ["MERCHANT_OWNER", "MERCHANT_ADMIN", "MERCHANT_EMPLOYEE"];

export const MERCHANT_NAV = [
  { to: "/merchant/dashboard", label: "Dashboard", roles: ALL_ROLES, icon: "grid" },
  { to: "/merchant/products", label: "Products", roles: ALL_ROLES, icon: "box" },
  { to: "/merchant/inventory", label: "Inventory", roles: ALL_ROLES, icon: "stack" },
  { to: "/merchant/orders", label: "Orders", roles: ALL_ROLES, icon: "cart" },
  { to: "/merchant/staff", label: "Staff", roles: ["MERCHANT_OWNER", "MERCHANT_ADMIN"], icon: "people" },
  { to: "/merchant/payouts", label: "Payouts", roles: ["MERCHANT_OWNER", "MERCHANT_ADMIN"], icon: "coin" },
  { to: "/merchant/settings", label: "Settings", roles: ALL_ROLES, icon: "gear" },
];

export function navForRole(role) {
  return MERCHANT_NAV.filter((item) => item.roles.includes(role));
}
