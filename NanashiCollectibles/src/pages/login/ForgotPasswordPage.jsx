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

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-amber-900/30 bg-gradient-to-br from-slate-950 via-purple-950/40 to-slate-950 p-8 text-center shadow-2xl shadow-purple-900/20">
        <span className="mb-4 block text-5xl">🔐</span>
        <h1 className="font-serif text-3xl font-bold text-amber-100">
          Reset Password
        </h1>
        <p className="mt-2 font-serif text-sm italic text-amber-100/70">
          Request a token, then set your new password.
        </p>

        <div className="mt-4 text-xs text-amber-100/60">
          Socket:{" "}
          <span className={isConnected ? "text-emerald-300" : "text-red-300"}>
            {isConnected ? "Connected" : "Disconnected"}
          </span>
        </div>
      </div>

      <div className="space-y-5 rounded-2xl border border-amber-900/30 bg-gradient-to-br from-slate-950 to-purple-950/30 p-8 shadow-lg shadow-purple-900/20">
        {error ? (
          <div className="rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {requestMessage ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
            {requestMessage}
          </div>
        ) : null}

        {resetMessage ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
            {resetMessage}
          </div>
        ) : null}

        <form onSubmit={handleRequestToken} className="space-y-3">
          <h2 className="font-serif text-lg font-semibold text-amber-100">1) Request Reset Token</h2>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your account email"
            className="w-full rounded-lg border border-amber-900/30 bg-slate-950 px-4 py-3 font-serif text-sm text-amber-100 placeholder-amber-100/40 focus:outline-none focus:ring-2 focus:ring-amber-600"
          />
          <button
            type="submit"
            disabled={loadingRequest}
            className="w-full rounded-xl border border-amber-600/50 bg-gradient-to-r from-amber-950/50 to-purple-950/50 py-3 font-serif text-base font-bold text-amber-100 transition-all hover:border-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingRequest ? "Requesting..." : "Request Token"}
          </button>
        </form>

        <form onSubmit={handleResetPassword} className="space-y-3">
          <h2 className="font-serif text-lg font-semibold text-amber-100">2) Reset Password</h2>
          <input
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Paste your reset token"
            className="w-full rounded-lg border border-amber-900/30 bg-slate-950 px-4 py-3 font-serif text-sm text-amber-100 placeholder-amber-100/40 focus:outline-none focus:ring-2 focus:ring-amber-600"
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password"
            className="w-full rounded-lg border border-amber-900/30 bg-slate-950 px-4 py-3 font-serif text-sm text-amber-100 placeholder-amber-100/40 focus:outline-none focus:ring-2 focus:ring-amber-600"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            className="w-full rounded-lg border border-amber-900/30 bg-slate-950 px-4 py-3 font-serif text-sm text-amber-100 placeholder-amber-100/40 focus:outline-none focus:ring-2 focus:ring-amber-600"
          />
          <button
            type="submit"
            disabled={loadingReset}
            className="w-full rounded-xl border border-amber-600/50 bg-gradient-to-r from-amber-950/50 to-purple-950/50 py-3 font-serif text-base font-bold text-amber-100 transition-all hover:border-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingReset ? "Resetting..." : "Reset Password"}
          </button>
        </form>

        <div className="text-center text-sm text-amber-100/70">
          Back to{" "}
          <Link to="/login" className="font-semibold text-amber-400 hover:text-amber-300">
            Login
          </Link>
        </div>
      </div>
    </div>
  );
}
