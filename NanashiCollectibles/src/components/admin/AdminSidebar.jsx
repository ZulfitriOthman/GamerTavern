import { Link } from "react-router-dom";
import AdminNavLinks from "./AdminNavLinks.jsx";

export default function AdminSidebar({ userName }) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-white/10 bg-ink-900/60 lg:flex">
      <div className="flex h-16 items-center border-b border-white/10 px-5">
        <Link to="/admin/dashboard" className="rounded font-display text-base font-semibold text-amber-50 focus-ring">
          Nanashi<span className="text-brand-400">Admin</span>
        </Link>
      </div>

      <div className="border-b border-white/10 px-5 py-4">
        <p className="truncate text-sm font-medium text-amber-50/85">{userName}</p>
        <p className="text-xs text-amber-50/45">Administrator</p>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <AdminNavLinks />
      </div>
    </aside>
  );
}
