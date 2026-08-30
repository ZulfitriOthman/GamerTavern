import Section from "../../components/layout/Section.jsx";
import SectionHeading from "../../components/ui/SectionHeading.jsx";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import { serviceProcess, services } from "../../config/site.js";

export default function ServiceDetailPage({ serviceKey }) {
  const service = services.find((item) => item.key === serviceKey);
  if (!service) return null;

  return (
    <>
      <Section spacing="lg" className="pt-14 sm:pt-20">
        <SectionHeading eyebrow="Services" title={service.name} description={service.summary} />
      </Section>

      <Section tone="muted" spacing="md">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div>
            <SectionHeading size="section" title="What this covers" />
            <ul className="mt-5 flex flex-col gap-3 text-sm text-amber-50/70">
              {service.examples.map((example) => (
                <li key={example} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                  {example}
                </li>
              ))}
            </ul>
          </div>

          <Card variant="elevated" className="flex flex-col gap-3">
            <h3 className="font-display text-lg font-semibold text-amber-50">Ready to start?</h3>
            <p className="text-sm text-amber-50/60">
              Enquiries and quotation requests aren't wired up to the backend yet — reach out directly for now.
            </p>
            <Button to="/contact" className="w-fit">
              Request a quotation
            </Button>
          </Card>
        </div>
      </Section>

      <Section spacing="md" className="pb-24">
        <SectionHeading size="section" title="How it works" />
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {serviceProcess.map((item) => (
            <Card key={item.step}>
              <h3 className="font-display text-base font-semibold text-amber-50">{item.step}</h3>
              <p className="mt-2 text-sm text-amber-50/60">{item.description}</p>
            </Card>
          ))}
        </div>
      </Section>
    </>
  );
}
