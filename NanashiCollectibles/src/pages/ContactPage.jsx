import { useState } from "react";
import Section from "../components/layout/Section.jsx";
import SectionHeading from "../components/ui/SectionHeading.jsx";
import Card from "../components/ui/Card.jsx";
import Button from "../components/ui/Button.jsx";

const ENQUIRY_TYPES = [
  "General enquiry",
  "Shop order",
  "Professional service quotation",
  "RVS Esports / tournament",
  "TCG community",
];

const fieldClasses =
  "w-full rounded-lg border border-white/10 bg-ink-900 px-3.5 py-2.5 text-sm text-amber-50 placeholder:text-amber-50/30 focus:border-brand-400 focus:outline-none";

export default function ContactPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    enquiryType: ENQUIRY_TYPES[0],
    message: "",
  });

  function updateField(field) {
    return (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));
  }

  return (
    <Section className="pt-16 sm:pt-24">
      <SectionHeading
        eyebrow="Contact"
        title="Get in touch"
        description="Tell us what you're after and we'll route it to the right part of NanashiCollectibles."
      />

      <Card className="mt-10 max-w-xl">
        <form className="flex flex-col gap-4" onSubmit={(event) => event.preventDefault()}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm text-amber-50/70">
              Name
              <input
                type="text"
                className={fieldClasses}
                value={form.name}
                onChange={updateField("name")}
                autoComplete="name"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-amber-50/70">
              Email
              <input
                type="email"
                className={fieldClasses}
                value={form.email}
                onChange={updateField("email")}
                autoComplete="email"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5 text-sm text-amber-50/70">
            Enquiry type
            <select
              className={fieldClasses}
              value={form.enquiryType}
              onChange={updateField("enquiryType")}
            >
              {ENQUIRY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm text-amber-50/70">
            Message
            <textarea
              rows={5}
              className={fieldClasses}
              value={form.message}
              onChange={updateField("message")}
            />
          </label>

          <Button type="submit" disabled className="mt-2 cursor-not-allowed opacity-50">
            Send enquiry
          </Button>
          <p className="text-xs text-amber-50/40">
            Online enquiry submission isn't connected yet — this form is a placeholder for the
            upcoming enquiry pipeline.
          </p>
        </form>
      </Card>
    </Section>
  );
}
