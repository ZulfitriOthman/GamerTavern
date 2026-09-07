import { useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import Section from "../../components/layout/Section.jsx";
import Card from "../../components/ui/Card.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import { TextField } from "../../components/ui/Field.jsx";
import { useMerchantAuth } from "../../features/merchant/MerchantAuthContext.js";

export default function MerchantLoginPage() {
  const { authState, login } = useMerchantAuth();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Already signed in with merchant access — skip the login form entirely.
  if (authState === "ready" || authState === "not_active") {
    return <Navigate to={location.state?.from || "/merchant/dashboard"} replace />;
  }

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
    } catch (err) {
      // Backend standardized errors: { success:false, code, message } — message is
      // already safe to show directly (never a stack trace or SQL detail).
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Section spacing="lg" className="pt-14 sm:pt-20">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div className="hidden flex-col gap-4 lg:flex">
          <Badge tone="signal">Merchant Portal</Badge>
          <p className="font-display text-3xl font-semibold text-amber-50">
            Manage your NanashiCollectibles storefront
          </p>
          <p className="max-w-sm text-sm text-amber-50/60">
            Products, inventory, orders, and payouts — all in one place.
          </p>
        </div>

        <Card variant="form" className="mx-auto w-full max-w-md">
          <h1 className="font-display text-xl font-semibold text-amber-50 sm:text-2xl">Merchant log in</h1>
          <p className="mt-1 text-sm text-amber-50/60">Access your store dashboard.</p>

          <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
            <TextField
              id="merchant-login-email"
              label="Email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />

            <div className="flex flex-col gap-1.5">
              <div className="relative">
                <TextField
                  id="merchant-login-password"
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  className="pr-16"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-[34px] rounded text-xs font-medium text-amber-50/50 hover:text-amber-50/80 focus-ring"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {error ? (
              <p role="alert" className="text-sm text-danger-400">
                {error}
              </p>
            ) : null}

            <Button type="submit" isLoading={submitting}>
              {submitting ? "Logging in…" : "Log in"}
            </Button>

            <p className="text-sm text-amber-50/50">
              New merchant?{" "}
              <Link to="/merchant/register" className="rounded text-brand-400 hover:text-brand-300 focus-ring">
                Register your store
              </Link>
            </p>
          </form>
        </Card>
      </div>
    </Section>
  );
}
