import { NavLink, Outlet } from "react-router-dom";
import SectionHeading from "../../components/ui/SectionHeading.jsx";

const tabClasses = ({ isActive }) =>
  [
    "rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 focus-ring",
    isActive ? "bg-brand-500/15 text-amber-50" : "text-amber-50/60 hover:text-amber-50",
  ].join(" ");

export default function MerchantSettingsLayout() {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <SectionHeading eyebrow="Store" title="Settings" size="section" />

      <div className="flex gap-1 border-b border-white/10 pb-1">
        <NavLink to="/merchant/settings/profile" className={tabClasses}>
          Profile
        </NavLink>
        <NavLink to="/merchant/settings/bank" className={tabClasses}>
          Bank details
        </NavLink>
      </div>

      <Outlet />
    </div>
  );
}
