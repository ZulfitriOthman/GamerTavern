import EmptyState from "../ui/EmptyState.jsx";
import { useMerchantAuth } from "../../features/merchant/MerchantAuthContext.js";

// Frontend convenience only — the backend (Backend/modules/restAuth.module.js
// requireMerchant) is the real authority and will reject any request this happens
// to let through by mistake. This just avoids showing a page whose every API call
// would 403.
export default function RoleGate({ allow, children }) {
  const { role } = useMerchantAuth();
  if (!allow.includes(role)) {
    return (
      <EmptyState
        title="Not available for your role"
        description="This section is restricted. Contact your store owner if you believe you should have access."
      />
    );
  }
  return children;
}
