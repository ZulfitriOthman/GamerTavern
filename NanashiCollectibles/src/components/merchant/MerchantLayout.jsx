import { useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import Spinner from "../ui/Spinner.jsx";
import MerchantSidebar from "./MerchantSidebar.jsx";
import MerchantTopbar from "./MerchantTopbar.jsx";
import MerchantMobileDrawer from "./MerchantMobileDrawer.jsx";
import { useMerchantAuth } from "../../features/merchant/MerchantAuthContext.js";

// Route guard + shell for every protected /merchant/* page. Redirects rather than
// rendering a blocked page — see MerchantAuthProvider's authState for what each
// state means. Frontend gating here is convenience; the backend enforces this for
// real on every API call regardless of what this component decides to render.
export default function MerchantLayout() {
  const { authState, user, activeMerchant, role, logout } = useMerchantAuth();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (authState === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950">
        <Spinner size="md" className="text-amber-50/50" />
      </div>
    );
  }

  if (authState === "unauthenticated") {
    return <Navigate to="/merchant/login" state={{ from: location.pathname }} replace />;
  }

  if (authState === "no_access" || authState === "not_active") {
    return <Navigate to="/merchant/pending" replace />;
  }

  return (
    <div className="flex min-h-screen bg-ink-950 text-amber-50">
      <MerchantSidebar role={role} businessName={activeMerchant?.displayName} />
      <MerchantMobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        role={role}
        businessName={activeMerchant?.displayName}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <MerchantTopbar onOpenDrawer={() => setDrawerOpen(true)} user={user} onLogout={logout} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
