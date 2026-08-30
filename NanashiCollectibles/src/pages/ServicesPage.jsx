import Section from "../components/layout/Section.jsx";
import SectionHeading from "../components/ui/SectionHeading.jsx";
import Card from "../components/ui/Card.jsx";
import Badge from "../components/ui/Badge.jsx";
import Button from "../components/ui/Button.jsx";
import { serviceProcess, services } from "../config/site.js";

export default function ServicesPage() {
  return (
    <>
      <Section spacing="lg" className="pt-14 sm:pt-20">
        <SectionHeading
          eyebrow="Services"
          title="Professional services beyond the shop"
          description="Drone, website, and application development for real businesses and events — delivered as scoped projects with a quotation, not shop checkout items."
        />
      </Section>

      <Section tone="muted" spacing="md">
        <div className="flex flex-col divide-y divide-white/5">
          {services.map((service) => (
            <div
              key={service.key}
              className="flex flex-col gap-4 py-8 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex-1">
                <h2 className="font-display text-xl font-semibold text-amber-50">{service.name}</h2>
                <p className="mt-2 max-w-xl text-sm text-amber-50/60">{service.summary}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {service.examples.slice(0, 3).map((example) => (
                    <Badge key={example}>{example}</Badge>
                  ))}
                </div>
              </div>
              <Button to={service.to} variant="secondary" className="shrink-0">
                View details
              </Button>
            </div>
          ))}
        </div>
      </Section>

      <Section spacing="md" className="pb-24">
        <SectionHeading size="section" title="How engagement works" />
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {serviceProcess.map((item) => (
            <Card key={item.step}>
              <h3 className="font-display text-base font-semibold text-amber-50">{item.step}</h3>
              <p className="mt-2 text-sm text-amber-50/60">{item.description}</p>
            </Card>
          ))}
        </div>
        <Button to="/contact" className="mt-8">
          Talk to us about a project
        </Button>
      </Section>
    </>
  );
}
