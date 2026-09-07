import { Outlet } from "react-router-dom";
import { MerchantAuthProvider } from "./MerchantAuthProvider.jsx";

// Wraps every /merchant/* route (login/register/pending included, not just the
// protected shell) so MerchantAuthProvider is available to all of them.
export default function MerchantRoot() {
  return (
    <MerchantAuthProvider>
      <Outlet />
    </MerchantAuthProvider>
  );
}
