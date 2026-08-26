import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Section from "../../components/layout/Section.jsx";
import SectionHeading from "../../components/ui/SectionHeading.jsx";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import { useAuth } from "./AuthContext.js";

const fieldClasses =
  "w-full rounded-lg border border-white/10 bg-ink-900 px-3.5 py-2.5 text-sm text-amber-50 placeholder:text-amber-50/30 focus:border-brand-400 focus:outline-none";

// Fields match Backend/routes/api/auth.routes.js's REGISTER_ALLOWED_FIELDS exactly —
// name, email, password required; phone optional. Password only needs to be 8+ chars
// per that route (no complexity rule is enforced there).
export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function updateField(field) {
    return (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    if (!form.name || !form.email || !form.password) {
      setError("Name, email, and password are required.");
      return;
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    try {
      await register(form);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Section className="pt-16 sm:pt-24">
      <SectionHeading
        eyebrow="Account"
        title="Create an account"
        description="Register to join tournaments, trade, and more."
      />

      <Card className="mt-10 max-w-md">
        <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          <label className="flex flex-col gap-1.5 text-sm text-amber-50/70" htmlFor="register-name">
            Name
            <input
              id="register-name"
              type="text"
              className={fieldClasses}
              value={form.name}
              onChange={updateField("name")}
              autoComplete="name"
              required
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm text-amber-50/70" htmlFor="register-email">
            Email
            <input
              id="register-email"
              type="email"
              className={fieldClasses}
              value={form.email}
              onChange={updateField("email")}
              autoComplete="email"
              required
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm text-amber-50/70" htmlFor="register-phone">
            Phone <span className="text-amber-50/40">(optional)</span>
            <input
              id="register-phone"
              type="tel"
              className={fieldClasses}
              value={form.phone}
              onChange={updateField("phone")}
              autoComplete="tel"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm text-amber-50/70" htmlFor="register-password">
            Password
            <input
              id="register-password"
              type="password"
              className={fieldClasses}
              value={form.password}
              onChange={updateField("password")}
              autoComplete="new-password"
              minLength={8}
              required
            />
            <span className="text-xs text-amber-50/40">At least 8 characters.</span>
          </label>

          {error ? (
            <p role="alert" className="text-sm text-rose-400">
              {error}
            </p>
          ) : null}

          <Button type="submit" disabled={submitting} className={submitting ? "opacity-60" : ""}>
            {submitting ? "Creating account…" : "Create account"}
          </Button>

          <p className="text-sm text-amber-50/50">
            Already have an account?{" "}
            <Link to="/login" className="text-brand-400 hover:text-brand-300">
              Log in
            </Link>
          </p>
        </form>
      </Card>
    </Section>
  );
}
