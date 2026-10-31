import { NavLink } from "react-router-dom";
import MerchantNavIcon from "../merchant/MerchantNavIcon.jsx";
import { ADMIN_NAV } from "./adminNav.js";

const linkClasses = ({ isActive }) =>
  [
    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150 focus-ring",
    isActive
      ? "bg-brand-500/15 text-amber-50"
      : "text-amber-50/60 hover:bg-white/5 hover:text-amber-50",
  ].join(" ");

export default function AdminNavLinks({ onNavigate }) {
  return (
    <nav aria-label="Admin" className="flex flex-col gap-1">
      {ADMIN_NAV.map((item) => (
        <NavLink key={item.to} to={item.to} onClick={onNavigate} className={linkClasses}>
          <MerchantNavIcon name={item.icon} className="h-4 w-4 shrink-0" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
