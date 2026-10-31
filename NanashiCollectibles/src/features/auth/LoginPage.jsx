import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Section from "../../components/layout/Section.jsx";
import Card from "../../components/ui/Card.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import { TextField } from "../../components/ui/Field.jsx";
import { useAuth } from "./AuthContext.js";
import { safeRedirect } from "./safeRedirect.js";
import { site } from "../../config/site.js";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }

    setSubmitting(true);
    try {
      await login({ email, password });
      navigate(safeRedirect(location.state?.from), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Section spacing="lg" className="pt-14 sm:pt-20">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        {/* Supporting brand panel — desktop only, form stays the only thing on mobile. */}
        <div className="hidden flex-col gap-4 lg:flex">
          <Badge tone="signal">{site.name}</Badge>
          <p className="font-display text-3xl font-semibold text-amber-50">
            One account across every Nanashi vertical
          </p>
          <p className="max-w-sm text-sm text-amber-50/60">
            Your account carries your tournament registrations — no need to re-enter your details
            as new RVS Esports events open.
          </p>
        </div>

        <Card variant="form" className="mx-auto w-full max-w-md">
          <h1 className="font-display text-xl font-semibold text-amber-50 sm:text-2xl">Log in</h1>
          <p className="mt-1 text-sm text-amber-50/60">Access your NanashiCollectibles account.</p>

          <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
            <TextField
              id="login-email"
              label="Email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
            <TextField
              id="login-password"
              label="Password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />

            <Link
              to="/forgot-password"
              className="-mt-2 self-end rounded text-xs text-amber-50/50 hover:text-brand-300 focus-ring"
            >
              Forgot password?
            </Link>

            {error ? (
              <p role="alert" className="text-sm text-danger-400">
                {error}
              </p>
            ) : null}

            <Button type="submit" isLoading={submitting}>
              {submitting ? "Logging in…" : "Log in"}
            </Button>

            <p className="text-sm text-amber-50/50">
              No account yet?{" "}
              <Link to="/register" className="rounded text-brand-400 hover:text-brand-300 focus-ring">
                Register
              </Link>
            </p>
          </form>
        </Card>
      </div>
    </Section>
  );
}
