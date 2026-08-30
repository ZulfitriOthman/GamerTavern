import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Section from "../components/layout/Section.jsx";
import Card from "../components/ui/Card.jsx";
import Button from "../components/ui/Button.jsx";
import { SelectField, TextareaField, TextField } from "../components/ui/Field.jsx";
import { useSocket } from "../services/socket/SocketContext.js";
import { createEnquiry, listServices } from "../features/services/servicesService.js";

// topic values match Backend/controllers/services.controller.js's VALID_TOPICS exactly.
const ENQUIRY_TYPES = [
  { label: "General enquiry", topic: "general" },
  { label: "Shop order", topic: "shop" },
  { label: "Professional service quotation", topic: "service" },
  { label: "RVS Esports / tournament", topic: "esports" },
  { label: "TCG community", topic: "tcg" },
];

const QUICK_LINKS = [
  { label: "Browse the shop", to: "/shop" },
  { label: "View services", to: "/services" },
  { label: "RVS Esports tournaments", to: "/esports/tournaments" },
];

export default function ContactPage() {
  const { socket } = useSocket();

  const [form, setForm] = useState({
    name: "",
    email: "",
    topic: ENQUIRY_TYPES[0].topic,
    serviceId: "",
    message: "",
  });
  const [services, setServices] = useState(null);
  const [servicesError, setServicesError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  function updateField(field) {
    return (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));
  }

  // The "Professional service quotation" topic requires a real serviceId — fetched
  // on demand (once) rather than sourced from site.js, since site.js only has slugs,
  // not the database ids the backend actually validates against.
  useEffect(() => {
    if (form.topic !== "service" || services !== null || !socket) return;
    listServices(socket)
      .then((data) => setServices(data || []))
      .catch((err) => setServicesError(err.message));
  }, [form.topic, services, socket]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setError("Name, email, and message are required.");
      return;
    }
    if (form.topic === "service" && !form.serviceId) {
      setError("Choose which service this enquiry is about.");
      return;
    }

    setSubmitting(true);
    try {
      await createEnquiry(socket, {
        topic: form.topic,
        name: form.name.trim(),
        email: form.email.trim(),
        message: form.message.trim(),
        serviceId: form.topic === "service" ? Number(form.serviceId) : undefined,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setForm({ name: "", email: "", topic: ENQUIRY_TYPES[0].topic, serviceId: "", message: "" });
    setSubmitted(false);
    setError(null);
  }

  return (
    <Section spacing="lg" className="pb-24 pt-14 sm:pt-20">
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div className="flex flex-col gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-signal-400">Contact</p>
            <h1 className="mt-3 font-display text-3xl font-semibold text-amber-50 sm:text-4xl">Get in touch</h1>
            <p className="mt-3 max-w-md text-base text-amber-50/70">
              Tell us what you're after and we'll route it to the right part of NanashiCollectibles.
            </p>
          </div>

          <Card variant="data">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-50/45">
              Looking for something specific?
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {QUICK_LINKS.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="rounded text-sm text-amber-50/70 hover:text-amber-50 focus-ring">
                    {link.label} →
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <Card variant="form">
          {submitted ? (
            <div className="flex flex-col items-start gap-3">
              <h2 className="font-display text-lg font-semibold text-amber-50">Enquiry received</h2>
              <p className="text-sm text-amber-50/60">Thanks — we've received your enquiry. We'll be in touch soon.</p>
              <Button variant="secondary" onClick={resetForm}>
                Send another enquiry
              </Button>
            </div>
          ) : (
            <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  id="contact-name"
                  label="Name"
                  type="text"
                  value={form.name}
                  onChange={updateField("name")}
                  autoComplete="name"
                  required
                />
                <TextField
                  id="contact-email"
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={updateField("email")}
                  autoComplete="email"
                  required
                />
              </div>

              <SelectField id="contact-enquiry-type" label="Enquiry type" value={form.topic} onChange={updateField("topic")}>
                {ENQUIRY_TYPES.map((type) => (
                  <option key={type.topic} value={type.topic}>
                    {type.label}
                  </option>
                ))}
              </SelectField>

              {form.topic === "service" ? (
                <SelectField
                  id="contact-service"
                  label="Which service?"
                  value={form.serviceId}
                  onChange={updateField("serviceId")}
                  error={servicesError}
                  required
                >
                  <option value="" disabled>
                    {services === null ? "Loading services…" : "Select a service"}
                  </option>
                  {(services || []).map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </SelectField>
              ) : null}

              <TextareaField
                id="contact-message"
                label="Message"
                rows={5}
                value={form.message}
                onChange={updateField("message")}
                required
              />

              {error ? (
                <p role="alert" className="text-sm text-danger-400">
                  {error}
                </p>
              ) : null}

              <Button type="submit" isLoading={submitting}>
                {submitting ? "Sending…" : "Send enquiry"}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </Section>
  );
}
