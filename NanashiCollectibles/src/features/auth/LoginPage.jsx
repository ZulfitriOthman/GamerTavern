import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Section from "../../components/layout/Section.jsx";
import SectionHeading from "../../components/ui/SectionHeading.jsx";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import { useAuth } from "./AuthContext.js";

const fieldClasses =
  "w-full rounded-lg border border-white/10 bg-ink-900 px-3.5 py-2.5 text-sm text-amber-50 placeholder:text-amber-50/30 focus:border-brand-400 focus:outline-none";

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
      const redirectTo = location.state?.from ?? "/";
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Section className="pt-16 sm:pt-24">
      <SectionHeading eyebrow="Account" title="Log in" description="Access your NanashiCollectibles account." />

      <Card className="mt-10 max-w-md">
        <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          <label className="flex flex-col gap-1.5 text-sm text-amber-50/70" htmlFor="login-email">
            Email
            <input
              id="login-email"
              type="email"
              className={fieldClasses}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm text-amber-50/70" htmlFor="login-password">
            Password
            <input
              id="login-password"
              type="password"
              className={fieldClasses}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {error ? (
            <p role="alert" className="text-sm text-rose-400">
              {error}
            </p>
          ) : null}

          <Button type="submit" disabled={submitting} className={submitting ? "opacity-60" : ""}>
            {submitting ? "Logging in…" : "Log in"}
          </Button>

          <p className="text-sm text-amber-50/50">
            No account yet?{" "}
            <Link to="/register" className="text-brand-400 hover:text-brand-300">
              Register
            </Link>
          </p>
        </form>
      </Card>
    </Section>
  );
}
