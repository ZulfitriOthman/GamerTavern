import Section from "../../components/layout/Section.jsx";
import SectionHeading from "../../components/ui/SectionHeading.jsx";
import Card from "../../components/ui/Card.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import { useMerchantAuth } from "../../features/merchant/MerchantAuthContext.js";

const FEATURES = [
  { title: "Product Management", description: "List, edit, and organize your catalog with categories and variants." },
  { title: "Orders", description: "Track incoming orders from checkout through fulfillment." },
  { title: "Inventory", description: "Keep stock levels accurate as orders come in and go out." },
  { title: "Payouts", description: "See what your store is owed and how payouts are tracked." },
  { title: "Staff Management", description: "Invite staff to your store and control what they can access." },
];

// Maps merchant authState (see MerchantAuthProvider.jsx) to the primary CTA on this
// page, so a returning merchant never sees a login form they don't need. "loading"
// intentionally has no action — the primary button shows a loading state instead.
function primaryAction(authState) {
  switch (authState) {
    case "ready":
      return { label: "Go to Merchant Dashboard", to: "/merchant/dashboard" };
    case "not_active":
      return { label: "View Store Status", to: "/merchant/pending" };
    case "no_access":
      return { label: "Register as Merchant", to: "/merchant/register" };
    case "unauthenticated":
      return { label: "Merchant Login", to: "/merchant/login" };
    default:
      return null;
  }
}

export default function MerchantPortalPage() {
  const { authState } = useMerchantAuth();
  const isLoading = authState === "loading";
  const primary = primaryAction(authState);
  const showRegister = !isLoading && primary?.to !== "/merchant/register" && authState !== "ready";

  return (
    <>
      <Section spacing="lg" className="pt-14 sm:pt-20">
        <div className="flex flex-col items-center gap-6 text-center">
          <Badge tone="signal">Merchant Portal</Badge>
          <SectionHeading
            align="center"
            title="Sell on NanashiCollectibles"
            description="Manage your store's products, orders, inventory, and payouts from one dashboard."
            className="max-w-2xl"
          />

          <div className="flex flex-wrap items-center justify-center gap-3">
            {isLoading ? (
              <Button size="lg" isLoading>
                Loading…
              </Button>
            ) : (
              <Button to={primary.to} size="lg">
                {primary.label}
              </Button>
            )}

            {showRegister ? (
              <Button to="/merchant/register" variant="secondary" size="lg">
                Register as Merchant
              </Button>
            ) : null}
          </div>
        </div>
      </Section>

      <Section tone="muted" spacing="md" className="pb-24">
        <SectionHeading size="section" align="center" title="What you can do as a merchant" className="mx-auto" />
        <div className="mx-auto mt-8 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <Card key={feature.title}>
              <h3 className="font-display text-base font-semibold text-amber-50">{feature.title}</h3>
              <p className="mt-2 text-sm text-amber-50/60">{feature.description}</p>
            </Card>
          ))}
        </div>
      </Section>
    </>
  );
}
