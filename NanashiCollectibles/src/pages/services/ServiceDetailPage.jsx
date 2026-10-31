import { useEffect, useState } from "react";
import Section from "../../components/layout/Section.jsx";
import SectionHeading from "../../components/ui/SectionHeading.jsx";
import Card from "../../components/ui/Card.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import Icon from "../../components/ui/Icon.jsx";
import { TextField, TextareaField } from "../../components/ui/Field.jsx";
import { useSocket } from "../../services/socket/SocketContext.js";
import { createEnquiry, listServices } from "../../features/services/servicesService.js";
import { SERVICE_ICON } from "../../features/services/serviceIcons.js";
import { serviceProcess, services } from "../../config/site.js";

// The real SERVICES table (services:list) uses a `category` column with
// underscores ("web_development") where config/site.js's `key` uses hyphens
// ("web-development") — same three services, different naming convention
// per table. This resolves one to the other rather than hardcoding ids,
// which would silently drift if the real rows are ever reseeded.
function categoryForKey(key) {
  return key.replace(/-/g, "_");
}

function QuotationForm({ serviceKey, serviceName }) {
  const { socket, status: socketStatus } = useSocket();
  const [realServiceId, setRealServiceId] = useState(null);
  const [lookupError, setLookupError] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!socket || socketStatus !== "connected") return;
    listServices(socket)
      .then((rows) => {
        const match = (rows || []).find((s) => s.category === categoryForKey(serviceKey));
        if (match) setRealServiceId(match.id);
        else setLookupError("This service isn't available for quotation requests right now.");
      })
      .catch((err) => setLookupError(err.message));
  }, [socket, socketStatus, serviceKey]);

  function updateField(field) {
    return (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setError("Name, email, and message are required.");
      return;
    }
    if (!realServiceId) {
      setError(lookupError || "This service isn't available for quotation requests right now.");
      return;
    }
    setSubmitting(true);
    try {
      await createEnquiry(socket, {
        topic: "service",
        serviceId: realServiceId,
        name: form.name.trim(),
        email: form.email.trim(),
        message: form.message.trim(),
      });
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <Card variant="elevated" className="flex flex-col gap-3">
        <h3 className="font-display text-lg font-semibold text-amber-50">Quotation request received</h3>
        <p className="text-sm text-amber-50/60">
          Thanks — we've received your request for {serviceName}. We'll follow up with a scoped quotation soon.
        </p>
      </Card>
    );
  }

  return (
    <Card variant="elevated" className="flex flex-col gap-4">
      <div>
        <h3 className="font-display text-lg font-semibold text-amber-50">Request a quotation</h3>
        <p className="mt-1 text-sm text-amber-50/60">Tell us what you're building — we'll follow up directly.</p>
      </div>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <TextField id="service-quote-name" label="Name" value={form.name} onChange={updateField("name")} autoComplete="name" required />
        <TextField
          id="service-quote-email"
          label="Email"
          type="email"
          value={form.email}
          onChange={updateField("email")}
          autoComplete="email"
          required
        />
        <TextareaField
          id="service-quote-message"
          label="What do you need?"
          rows={4}
          value={form.message}
          onChange={updateField("message")}
          required
        />
        {error ? (
          <p role="alert" className="text-sm text-danger-400">
            {error}
          </p>
        ) : null}
        <Button type="submit" isLoading={submitting} className="w-fit">
          {submitting ? "Sending…" : "Send quotation request"}
        </Button>
      </form>
    </Card>
  );
}

// Used instead of QuotationForm when a service has no matching row in the
// real SERVICES table yet (service.quotable === false) — QuotationForm's
// lookup would only ever fail for it, so this routes to the existing
// /contact enquiry flow instead of showing a broken-looking quote form.
function ContactQuoteCta({ serviceName }) {
  return (
    <Card variant="elevated" className="flex flex-col gap-4">
      <div>
        <h3 className="font-display text-lg font-semibold text-amber-50">Planning an event?</h3>
        <p className="mt-1 text-sm text-amber-50/60">
          Talk to Nanashi about a {serviceName.toLowerCase()} setup for your event — we'll follow up with a scoped
          quotation.
        </p>
      </div>
      <Button to="/contact" className="w-fit">
        Get a quote
      </Button>
    </Card>
  );
}

export default function ServiceDetailPage({ serviceKey, children }) {
  const service = services.find((item) => item.key === serviceKey);
  if (!service) return null;

  return (
    <>
      <Section spacing="lg" className="pt-14 sm:pt-20">
        <div className="flex items-start gap-4">
          <span className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-brand-300 sm:flex">
            <Icon name={SERVICE_ICON[service.key] || "wrench"} className="h-6 w-6" />
          </span>
          <SectionHeading eyebrow="Services" title={service.name} description={service.summary} />
        </div>
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

          {service.quotable === false ? (
            <ContactQuoteCta serviceName={service.name} />
          ) : (
            <QuotationForm serviceKey={service.key} serviceName={service.name} />
          )}
        </div>
      </Section>

      {/* Extension point for service-specific content that doesn't belong in this
          shared template (e.g. the ticketing seating demo) — no-op for services that
          don't pass children. */}
      {children}

      <Section spacing="md" className={service.audience ? "" : "pb-24"}>
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

      {service.audience ? (
        <Section spacing="md" className="pb-24">
          <SectionHeading size="section" title="Who this is for" />
          <div className="mt-5 flex flex-wrap gap-2">
            {service.audience.map((item) => (
              <Badge key={item}>{item}</Badge>
            ))}
          </div>
        </Section>
      ) : null}
    </>
  );
}
