import Section from "../../components/layout/Section.jsx";
import Button from "../../components/ui/Button.jsx";
import BlurFade from "../../components/ui/BlurFade.jsx";
import Icon from "../../components/ui/Icon.jsx";

// Visually distinct from the plain Card/SpotlightCard modules above it (one
// intentional gradient, per the brief — not another bordered box) but a
// single section, not a giant banner, so it doesn't compete with the shop/
// services/TCG content it sits between.
export default function MerchantCta() {
  return (
    <Section spacing="sm" containerSize="wide">
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-ink-900/60 px-6 py-10 sm:px-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-brand-500/20 blur-3xl"
        />
        <div className="relative flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-brand-300">
              <Icon name="store" className="h-6 w-6" />
            </span>
            <div>
              <h2 className="font-display text-xl font-semibold text-amber-50 sm:text-2xl">Sell with Nanashi</h2>
              <p className="mt-2 max-w-lg text-sm text-amber-50/65">
                Manage products, inventory, orders, and your own storefront through the Merchant Portal.
              </p>
            </div>
          </div>
          <Button to="/merchant" size="lg" className="w-full shrink-0 sm:w-auto">
            Merchant Portal
          </Button>
        </div>
      </div>
    </Section>
  );
}
