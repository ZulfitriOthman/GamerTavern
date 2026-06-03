import { useState } from "react";
import { Link } from "react-router-dom";
import { useSocket } from "../../hooks/useSocket";

export default function ForgotPasswordPage() {
  const { isConnected, connect, emitAccountRequestReset, emitAccountResetPassword } =
    useSocket(null);

  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [requestMessage, setRequestMessage] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [error, setError] = useState("");
  const [loadingRequest, setLoadingRequest] = useState(false);
  const [loadingReset, setLoadingReset] = useState(false);

  const handleRequestToken = async (e) => {
    e.preventDefault();
    setError("");
    setRequestMessage("");

    const trimmedEmail = String(email || "").trim().toLowerCase();
    if (!trimmedEmail) {
      setError("Email is required.");
      return;
    }

    try {
      setLoadingRequest(true);
      connect?.();

      const res = await emitAccountRequestReset({ email: trimmedEmail });

      if (!res?.success) {
        setError(res?.message || "Failed to request reset token.");
        return;
      }

      const serverToken = res?.data?.token;
      if (serverToken) {
        setToken(serverToken);
      }

      setRequestMessage(res?.message || "Reset token generated.");
    } catch (err) {
      setError(err?.message || "Failed to request reset token.");
    } finally {
      setLoadingRequest(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");
    setResetMessage("");

    if (!token.trim()) {
      setError("Reset token is required.");
      return;
    }

    if (!newPassword || !confirmPassword) {
      setError("New password and confirm password are required.");
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoadingReset(true);
      connect?.();

      const res = await emitAccountResetPassword({
        token: token.trim(),
        newPassword,
        confirmPassword,
      });

      if (!res?.success) {
        setError(res?.message || "Failed to reset password.");
        return;
      }

      setResetMessage(res?.message || "Password updated successfully.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err?.message || "Failed to reset password.");
    } finally {
      setLoadingReset(false);
    }
  };

  const inputClass =
    "w-full rounded-xl border border-white/15 bg-black/35 px-4 py-3 font-serif text-sm text-white placeholder-white/35 transition focus:border-purple-400/70 focus:outline-none focus:ring-2 focus:ring-purple-400/25";

  const actionButtonClass =
    "relative w-full overflow-hidden rounded-xl border border-purple-300/50 bg-gradient-to-r from-purple-600/65 via-purple-500/60 to-cyan-500/45 py-3 font-serif text-base font-black uppercase tracking-[0.08em] text-white transition-all duration-200 hover:border-purple-200/80 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div className="mx-auto max-w-5xl">
      <div className="grid gap-4 lg:grid-cols-[1.02fr_1.38fr]">
        <aside className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-black/75 via-purple-950/25 to-black/70 p-7 shadow-2xl shadow-purple-500/20 lg:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(167,139,250,0.24),transparent_46%),radial-gradient(circle_at_100%_100%,rgba(56,189,248,0.16),transparent_45%)]" />
          <div className="relative">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-xl border border-white/20 bg-purple-500/20 text-3xl shadow-[0_0_24px_rgba(168,85,247,0.35)]">
              🔐
            </div>

            <h1 className="mt-6 font-serif text-4xl font-black uppercase tracking-[0.08em] text-white sm:text-[2.65rem]">
              Account
              <span className="block text-purple-300">Recovery</span>
            </h1>

            <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/65">
              Request a reset token, then securely create your new password to
              regain account access.
            </p>

            <div className="mt-8 space-y-3">
              <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3">
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-purple-200/70">
                  Step 1
                </p>
                <p className="mt-1 font-serif text-lg font-bold uppercase tracking-[0.08em] text-white">
                  Request Token
                </p>
                <p className="text-xs text-white/55">Use your account email.</p>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3">
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-200/70">
                  Step 2
                </p>
                <p className="mt-1 font-serif text-lg font-bold uppercase tracking-[0.08em] text-white">
                  Set New Password
                </p>
                <p className="text-xs text-white/55">Token + password confirmation required.</p>
              </div>
            </div>
          </div>
        </aside>

        <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-black/80 via-slate-950/70 to-purple-950/30 p-6 shadow-2xl shadow-black/45 sm:p-8">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-300/45 to-transparent" />
          <div className="absolute -right-24 -top-24 h-60 w-60 rounded-full bg-purple-500/10 blur-3xl" />

          <div className="relative z-10 space-y-4">
            {error ? (
              <div className="rounded-xl border border-red-500/40 bg-red-950/35 px-4 py-3 text-sm text-red-100">
                {error}
              </div>
            ) : null}

            {requestMessage ? (
              <div className="rounded-xl border border-emerald-500/35 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
                {requestMessage}
              </div>
            ) : null}

            {resetMessage ? (
              <div className="rounded-xl border border-emerald-500/35 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
                {resetMessage}
              </div>
            ) : null}

            <form onSubmit={handleRequestToken} className="space-y-3 rounded-xl border border-white/10 bg-black/30 p-4">
              <h2 className="text-xs font-black uppercase tracking-[0.22em] text-white/65">
                1) Request Reset Token
              </h2>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your account email"
                className={inputClass}
              />
              <button type="submit" disabled={loadingRequest} className={actionButtonClass}>
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 transition-opacity duration-300 hover:opacity-100" />
                <span className="relative">{loadingRequest ? "Requesting..." : "Request Token"}</span>
              </button>
            </form>

            <form onSubmit={handleResetPassword} className="space-y-3 rounded-xl border border-white/10 bg-black/30 p-4">
              <h2 className="text-xs font-black uppercase tracking-[0.22em] text-white/65">
                2) Reset Password
              </h2>
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste your reset token"
                className={inputClass}
              />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password"
                className={inputClass}
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className={inputClass}
              />
              <button type="submit" disabled={loadingReset} className={actionButtonClass}>
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 transition-opacity duration-300 hover:opacity-100" />
                <span className="relative">{loadingReset ? "Resetting..." : "Reset Password"}</span>
              </button>
            </form>

            <div className="pt-1 text-center text-sm text-white/55">
              Back to{" "}
              <Link to="/login" className="font-semibold text-purple-200 transition hover:text-purple-100">
                Login
              </Link>
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-300/35 to-transparent" />
        </section>
      </div>
    </div>
  );
}
