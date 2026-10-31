import { useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import Spinner from "../ui/Spinner.jsx";
import Button from "../ui/Button.jsx";
import ErrorState from "../ui/ErrorState.jsx";
// MerchantTopbar is a fully generic top bar (hamburger + user name + logout) with no
// merchant-specific logic — reused here rather than duplicating it (CLAUDE.md: avoid
// duplicate navigation primitives). AdminSidebar/AdminMobileDrawer carry admin-specific
// branding/links and aren't shared.
import MerchantTopbar from "../merchant/MerchantTopbar.jsx";
import AdminSidebar from "./AdminSidebar.jsx";
import AdminMobileDrawer from "./AdminMobileDrawer.jsx";
import { useAuth } from "../../features/auth/AuthContext.js";

// Route guard + shell for every /admin/* page. Admin is not a separate auth
// system — it reuses the same shared session as the storefront/merchant
// portal (see features/auth/AuthContext.js); "admin" just means
// user.role === "ADMIN" on that same JWT. Frontend gating here is
// convenience only — Backend/routes/api/admin.routes.js's requireAuth +
// requireAdmin enforce this for real on every API call regardless of what
// this component decides to render.
export default function AdminLayout() {
  const { status, user, logout } = useAuth();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950">
        <Spinner size="md" className="text-amber-50/50" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (String(user?.role || "").toUpperCase() !== "ADMIN") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4">
        <ErrorState
          icon="scale"
          title="Not authorized"
          description="Your account doesn't have admin access. If you believe this is a mistake, contact a site administrator."
          action={
            <Button to="/" variant="secondary">
              Back to NanashiCollectibles
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-ink-950 text-amber-50">
      <AdminSidebar userName={user?.name} />
      <AdminMobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} userName={user?.name} />

      <div className="flex min-w-0 flex-1 flex-col">
        <MerchantTopbar onOpenDrawer={() => setDrawerOpen(true)} user={user} onLogout={logout} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
