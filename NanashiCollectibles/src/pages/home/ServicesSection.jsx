import { Link } from "react-router-dom";
import Section from "../../components/layout/Section.jsx";
import SectionHeading from "../../components/ui/SectionHeading.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import SpotlightCard from "../../components/ui/SpotlightCard.jsx";
import Card from "../../components/ui/Card.jsx";
import BlurFade from "../../components/ui/BlurFade.jsx";
import Icon from "../../components/ui/Icon.jsx";
import { services } from "../../config/site.js";
import { SERVICE_ICON } from "../../features/services/serviceIcons.js";

export default function ServicesSection() {
  return (
    <Section tone="muted" spacing="md" containerSize="xwide">
      <BlurFade inView>
        <SectionHeading
          size="section"
          eyebrow="Services"
          title="Professional services beyond the shop"
          description="Drone, website, application development, and event ticketing, delivered as real projects with a quotation — not shop checkout items."
        />
      </BlurFade>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {services.map((service) => (
          <SpotlightCard
            key={service.key}
            as={Link}
            to={service.to}
            className="flex flex-col gap-5 p-6"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-brand-300">
              <Icon name={SERVICE_ICON[service.key] || "wrench"} className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-display text-lg font-semibold text-amber-50">{service.name}</h3>
              <p className="mt-2 text-sm text-amber-50/65">{service.summary}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {service.examples.slice(0, 2).map((example) => (
                <Badge key={example} className="text-xs">
                  {example}
                </Badge>
              ))}
            </div>
            <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-brand-300">
              Learn more <span aria-hidden="true">→</span>
            </span>
          </SpotlightCard>
        ))}
      </div>

      <Card
        variant="elevated"
        className="mt-4 flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center"
      >
        <div>
          <h3 className="font-display text-lg font-semibold text-amber-50">Have a project? Get a quote.</h3>
          <p className="mt-1.5 max-w-lg text-sm text-amber-50/65">
            Tell us what you're building — an event, a business system, or aerial coverage — and we'll follow up
            with a scoped quotation.
          </p>
        </div>
        <Button to="/contact" size="md" className="shrink-0">
          Get a quote
        </Button>
      </Card>
    </Section>
  );
}
