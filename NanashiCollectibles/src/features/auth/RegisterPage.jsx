import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Section from "../../components/layout/Section.jsx";
import Card from "../../components/ui/Card.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import { TextField } from "../../components/ui/Field.jsx";
import { useAuth } from "./AuthContext.js";
import { site } from "../../config/site.js";

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
    <Section spacing="lg" className="pt-14 sm:pt-20">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div className="hidden flex-col gap-4 lg:flex">
          <Badge tone="signal">{site.name}</Badge>
          <p className="font-display text-3xl font-semibold text-amber-50">
            Join tournaments, trade, and more
          </p>
          <p className="max-w-sm text-sm text-amber-50/60">
            One account works across every Nanashi vertical as it comes online — starting with
            RVS Esports tournament registration.
          </p>
        </div>

        <Card variant="form" className="mx-auto w-full max-w-md">
          <h1 className="font-display text-xl font-semibold text-amber-50 sm:text-2xl">Create an account</h1>
          <p className="mt-1 text-sm text-amber-50/60">Register to join tournaments, trade, and more.</p>

          <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
            <TextField
              id="register-name"
              label="Name"
              type="text"
              value={form.name}
              onChange={updateField("name")}
              autoComplete="name"
              required
            />

            <TextField
              id="register-email"
              label="Email"
              type="email"
              value={form.email}
              onChange={updateField("email")}
              autoComplete="email"
              required
            />

            <TextField
              id="register-phone"
              label="Phone"
              hint="Optional"
              type="tel"
              value={form.phone}
              onChange={updateField("phone")}
              autoComplete="tel"
            />

            <TextField
              id="register-password"
              label="Password"
              hint="At least 8 characters."
              type="password"
              value={form.password}
              onChange={updateField("password")}
              autoComplete="new-password"
              minLength={8}
              required
            />

            {error ? (
              <p role="alert" className="text-sm text-danger-400">
                {error}
              </p>
            ) : null}

            <Button type="submit" isLoading={submitting}>
              {submitting ? "Creating account…" : "Create account"}
            </Button>

            <p className="text-sm text-amber-50/50">
              Already have an account?{" "}
              <Link to="/login" className="rounded text-brand-400 hover:text-brand-300 focus-ring">
                Log in
              </Link>
            </p>
          </form>
        </Card>
      </div>
    </Section>
  );
}
