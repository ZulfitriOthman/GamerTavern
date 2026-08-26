import { Link } from "react-router-dom";
import Section from "../components/layout/Section.jsx";
import SectionHeading from "../components/ui/SectionHeading.jsx";
import Card from "../components/ui/Card.jsx";
import { services } from "../config/site.js";

export default function ServicesPage() {
  return (
    <Section className="pt-16 sm:pt-24">
      <SectionHeading
        eyebrow="Services"
        title="Professional services"
        description="Drone, website, and application development, delivered as real projects with a quotation — not shop checkout items."
      />
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {services.map((service) => (
          <Card key={service.key} as={Link} to={service.to} className="flex flex-col gap-3">
            <h2 className="font-display text-lg font-semibold text-amber-50">{service.name}</h2>
            <p className="text-sm text-amber-50/60">{service.summary}</p>
            <span className="mt-auto text-sm font-medium text-brand-400">Learn more →</span>
          </Card>
        ))}
      </div>
    </Section>
  );
}
