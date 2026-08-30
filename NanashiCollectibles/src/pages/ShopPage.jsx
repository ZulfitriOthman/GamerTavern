import Section from "../components/layout/Section.jsx";
import SectionHeading from "../components/ui/SectionHeading.jsx";
import Card from "../components/ui/Card.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import { shopCategories } from "../config/site.js";

export default function ShopPage() {
  return (
    <Section spacing="lg" className="pb-24 pt-14 sm:pt-20">
      <SectionHeading
        eyebrow="Shop"
        title="The NanashiCollectibles storefront"
        description="Categories the storefront is organized around. Live inventory isn't connected yet — this becomes a real product catalogue as the shop is wired up to the backend."
      />

      <div className="mt-10 grid gap-8 lg:grid-cols-[0.85fr_2.15fr] lg:items-start">
        <Card variant="data">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-50/45">Categories</p>
          <ul className="mt-3 flex flex-col gap-1">
            {shopCategories.map((category) => (
              <li key={category.name} className="text-sm font-medium text-amber-50/80">
                {category.name}
              </li>
            ))}
          </ul>
        </Card>

        <div className="flex flex-col gap-4">
          {shopCategories.map((category) => (
            <Card
              key={category.name}
              className="flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
            >
              <h2 className="font-display text-base font-semibold text-amber-50">{category.name}</h2>
              <p className="text-sm text-amber-50/60 sm:max-w-md sm:text-right">{category.description}</p>
            </Card>
          ))}
          <EmptyState
            title="Product listings are coming soon"
            description="This catalogue becomes a real, browsable product grid as the shop connects to the backend inventory."
          />
        </div>
      </div>
    </Section>
  );
}
