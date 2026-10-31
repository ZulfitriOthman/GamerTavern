import { Navigate } from "react-router-dom";
import Section from "../../components/layout/Section.jsx";
import Card from "../../components/ui/Card.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import { useMerchantAuth } from "../../features/merchant/MerchantAuthContext.js";

const MESSAGES = {
  PENDING: {
    tone: "gold",
    title: "Your merchant application is still under review",
    body: "Thanks for registering. An administrator needs to review and activate your store before you can list products or receive orders. This usually doesn't take long — check back soon.",
  },
  SUSPENDED: {
    tone: "danger",
    title: "Your store has been suspended",
    body: "Your merchant account is currently suspended and can't access the dashboard. Contact NanashiCollectibles support if you believe this is a mistake.",
  },
  REJECTED: {
    tone: "danger",
    title: "Your merchant application was not approved",
    body: "This store registration was rejected. Contact NanashiCollectibles support for details.",
  },
  MEMBERSHIP_SUSPENDED: {
    tone: "danger",
    title: "Your staff access has been suspended",
    body: "Your access to this store has been suspended by the store owner. Contact them if you believe this is a mistake.",
  },
  NO_ACCESS: {
    tone: "neutral",
    title: "No merchant store found",
    body: "This account isn't linked to a merchant store yet. Register a store to start selling on NanashiCollectibles.",
  },
};

export default function MerchantPendingPage() {
  const { authState, activeMerchant, logout } = useMerchantAuth();

  if (authState === "ready") return <Navigate to="/merchant/dashboard" replace />;
  if (authState === "loading" || authState === "unauthenticated") return <Navigate to="/merchant/login" replace />;

  let key = "NO_ACCESS";
  if (authState === "not_active") {
    key = activeMerchant?.membershipStatus !== "active" ? "MEMBERSHIP_SUSPENDED" : activeMerchant?.merchantStatus || "PENDING";
  }
  const info = MESSAGES[key] || MESSAGES.PENDING;

  return (
    <Section spacing="lg" className="pt-20">
      <Card variant="form" className="mx-auto w-full max-w-lg text-center">
        <div className="flex flex-col items-center gap-4">
          <Badge tone={info.tone}>{key === "NO_ACCESS" ? "No store" : "Store status"}</Badge>
          <h1 className="font-display text-2xl font-semibold text-amber-50">{info.title}</h1>
          <p className="text-sm text-amber-50/65">{info.body}</p>

          <div className="mt-2 flex flex-wrap justify-center gap-3">
            {key === "NO_ACCESS" ? <Button to="/merchant/register">Register a store</Button> : null}
            <Button variant="secondary" onClick={logout}>
              Log out
            </Button>
          </div>
        </div>
      </Card>
    </Section>
  );
}
