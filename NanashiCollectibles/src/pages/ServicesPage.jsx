import { Link } from "react-router-dom";
import Section from "../components/layout/Section.jsx";
import SectionHeading from "../components/ui/SectionHeading.jsx";
import Card from "../components/ui/Card.jsx";
import Badge from "../components/ui/Badge.jsx";
import Button from "../components/ui/Button.jsx";
import SpotlightCard from "../components/ui/SpotlightCard.jsx";
import Icon from "../components/ui/Icon.jsx";
import { serviceProcess, services } from "../config/site.js";
import { SERVICE_ICON } from "../features/services/serviceIcons.js";

export default function ServicesPage() {
  return (
    <>
      <Section spacing="lg" className="pt-14 sm:pt-20">
        <SectionHeading
          eyebrow="Services"
          title="Professional services beyond the shop"
          description="Drone, website, application development, and event ticketing for real businesses and events — delivered as scoped projects with a quotation, not shop checkout items."
        />
      </Section>

      <Section tone="muted" spacing="md">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((service) => (
            <SpotlightCard key={service.key} as={Link} to={service.to} className="flex flex-col gap-5 p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-brand-300">
                <Icon name={SERVICE_ICON[service.key] || "wrench"} className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-display text-lg font-semibold text-amber-50">{service.name}</h2>
                <p className="mt-2 text-sm text-amber-50/65">{service.summary}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {service.examples.slice(0, 3).map((example) => (
                  <Badge key={example} className="text-xs">
                    {example}
                  </Badge>
                ))}
              </div>
              <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-brand-300">
                View details <span aria-hidden="true">→</span>
              </span>
            </SpotlightCard>
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
