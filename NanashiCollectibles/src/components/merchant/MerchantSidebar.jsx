import { Link } from "react-router-dom";
import MerchantNavLinks from "./MerchantNavLinks.jsx";

export default function MerchantSidebar({ role, businessName }) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-white/10 bg-ink-900/60 lg:flex">
      <div className="flex h-16 items-center border-b border-white/10 px-5">
        <Link to="/merchant/dashboard" className="rounded font-display text-base font-semibold text-amber-50 focus-ring">
          Nanashi<span className="text-brand-400">Merchant</span>
        </Link>
      </div>

      <div className="border-b border-white/10 px-5 py-4">
        <p className="truncate text-sm font-medium text-amber-50/85">{businessName}</p>
        <p className="text-xs text-amber-50/45">{role?.replace("MERCHANT_", "").toLowerCase()}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <MerchantNavLinks role={role} />
      </div>
    </aside>
  );
}
