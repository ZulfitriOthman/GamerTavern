import { useState } from "react";
import { Link } from "react-router-dom";
import Section from "../../components/layout/Section.jsx";
import Card from "../../components/ui/Card.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import { TextField } from "../../components/ui/Field.jsx";
import * as authService from "./authService.js";

// The backend always returns the same generic message whether or not the email is
// registered (account-enumeration protection) — this page shows that message as-is
// and never tries to infer or reveal whether the account exists.
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    if (!email) {
      setError("Enter your email address.");
      return;
    }

    setSubmitting(true);
    try {
      await authService.forgotPassword({ email });
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Section spacing="lg" className="pt-14 sm:pt-20">
      <Card variant="form" className="mx-auto w-full max-w-md">
        {sent ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <Badge tone="signal">Check your email</Badge>
            <h1 className="font-display text-xl font-semibold text-amber-50 sm:text-2xl">
              If an account exists, we&rsquo;ve sent a reset link
            </h1>
            <p className="text-sm text-amber-50/60">
              Check the inbox for the email you entered. The link expires shortly, so use it soon.
            </p>
            <Button to="/login" variant="secondary" className="mt-2">
              Back to login
            </Button>
          </div>
        ) : (
          <>
            <h1 className="font-display text-xl font-semibold text-amber-50 sm:text-2xl">
              Forgot your password?
            </h1>
            <p className="mt-1 text-sm text-amber-50/60">
              Enter the email associated with your NanashiCollectibles account.
            </p>

            <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
              <TextField
                id="forgot-password-email"
                label="Email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />

              {error ? (
                <p role="alert" className="text-sm text-danger-400">
                  {error}
                </p>
              ) : null}

              <Button type="submit" isLoading={submitting}>
                {submitting ? "Sending…" : "Send Reset Link"}
              </Button>

              <p className="text-sm text-amber-50/50">
                <Link to="/login" className="rounded text-brand-400 hover:text-brand-300 focus-ring">
                  Back to login
                </Link>
              </p>
            </form>
          </>
        )}
      </Card>
    </Section>
  );
}
