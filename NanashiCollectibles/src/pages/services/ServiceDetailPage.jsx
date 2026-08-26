import Section from "../../components/layout/Section.jsx";
import SectionHeading from "../../components/ui/SectionHeading.jsx";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import { services } from "../../config/site.js";

export default function ServiceDetailPage({ serviceKey }) {
  const service = services.find((item) => item.key === serviceKey);
  if (!service) return null;

  return (
    <Section className="pt-16 sm:pt-24">
      <SectionHeading eyebrow="Services" title={service.name} description={service.summary} />

      <Card className="mt-10 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-50/40">
            Example work
          </h2>
          <ul className="mt-4 flex flex-col gap-2 text-sm text-amber-50/70">
            {service.examples.map((example) => (
              <li key={example} className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                {example}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-3 sm:w-64 sm:shrink-0">
          <p className="text-sm text-amber-50/60">
            Enquiries and quotation requests aren't wired up to the backend yet — reach out
            directly for now.
          </p>
          <Button to="/contact">Request a quotation</Button>
        </div>
      </Card>
    </Section>
  );
}
