import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import Section from "../../components/layout/Section.jsx";
import Card from "../../components/ui/Card.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import { TextField } from "../../components/ui/Field.jsx";
import * as authService from "./authService.js";

// Same 8-character minimum as RegisterPage.jsx / Backend/routes/api/auth.routes.js —
// no second password policy invented here.
export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    if (!password || !confirmPassword) {
      setError("Enter and confirm your new password.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await authService.resetPassword({ token, password, confirmPassword });
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <Section spacing="lg" className="pt-14 sm:pt-20">
        <Card variant="form" className="mx-auto w-full max-w-md text-center">
          <div className="flex flex-col items-center gap-4">
            <Badge tone="danger">Invalid link</Badge>
            <h1 className="font-display text-xl font-semibold text-amber-50 sm:text-2xl">
              This password reset link is invalid or has expired
            </h1>
            <p className="text-sm text-amber-50/60">
              Request a new link and use it within its expiry window.
            </p>
            <Button to="/forgot-password" className="mt-2">
              Request a new link
            </Button>
          </div>
        </Card>
      </Section>
    );
  }

  if (done) {
    return (
      <Section spacing="lg" className="pt-14 sm:pt-20">
        <Card variant="form" className="mx-auto w-full max-w-md text-center">
          <div className="flex flex-col items-center gap-4">
            <Badge tone="signal">Password updated</Badge>
            <h1 className="font-display text-xl font-semibold text-amber-50 sm:text-2xl">
              Password updated successfully
            </h1>
            <p className="text-sm text-amber-50/60">You can now sign in using your new password.</p>
            <Button to="/login" className="mt-2">
              Back to Login
            </Button>
          </div>
        </Card>
      </Section>
    );
  }

  return (
    <Section spacing="lg" className="pt-14 sm:pt-20">
      <Card variant="form" className="mx-auto w-full max-w-md">
        <h1 className="font-display text-xl font-semibold text-amber-50 sm:text-2xl">
          Create a new password
        </h1>
        <p className="mt-1 text-sm text-amber-50/60">Choose a new password for your account.</p>

        <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          <TextField
            id="reset-password-new"
            label="New Password"
            hint="At least 8 characters."
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />

          <TextField
            id="reset-password-confirm"
            label="Confirm Password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
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
            {submitting ? "Resetting…" : "Reset Password"}
          </Button>
        </form>
      </Card>
    </Section>
  );
}
