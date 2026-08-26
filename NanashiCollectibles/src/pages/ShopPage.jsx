import Section from "../components/layout/Section.jsx";
import SectionHeading from "../components/ui/SectionHeading.jsx";
import Card from "../components/ui/Card.jsx";
import Badge from "../components/ui/Badge.jsx";
import { shopCategories } from "../config/site.js";

export default function ShopPage() {
  return (
    <Section className="pt-16 sm:pt-24">
      <SectionHeading
        eyebrow="Shop"
        title="The NanashiCollectibles storefront"
        description="Categories the storefront is organized around. Live inventory isn't connected yet — this page will list real products once the shop is wired up to the backend catalogue."
      />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shopCategories.map((category) => (
          <Card key={category.name} className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-base font-semibold text-amber-50">
                {category.name}
              </h2>
              <Badge>Coming soon</Badge>
            </div>
            <p className="text-sm text-amber-50/60">{category.description}</p>
          </Card>
        ))}
      </div>
    </Section>
  );
}
