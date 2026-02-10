// NanashiCollectibles/src/pages/LoginPage.jsx
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSocket } from "../hooks/useSocket";

export default function LoginPage() {
  const navigate = useNavigate();

  // ✅ socket-only auth
  const { isConnected, connect, emitAccountLogin } = useSocket(null);

  const [formData, setFormData] = useState({
    name: "",
    password: "",
  });

  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = useMemo(() => {
    return (
      formData.name.trim().length >= 3 &&
      formData.password.length > 0 &&
      !isSubmitting
    );
  }, [formData, isSubmitting]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
    setServerError("");
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.name.trim())
      newErrors.name = "Name is required";
    else if (formData.name.trim().length < 3)
      newErrors.name = "Name must be at least 3 characters";

    if (!formData.password)
      newErrors.password = "Password is required";

    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    setServerError("");

    try {
      // ✅ ensure socket
      connect?.();

      const payload = {
        name: formData.name.trim(),
        password: formData.password,
      };

      const res = await emitAccountLogin(payload);
      console.log("Login response:", res);

      if (!res?.success) {
        setServerError(res?.message || "Invalid name or password.");
        return;
      }

      const user = res.data;

      // ✅ store user
      localStorage.setItem(
        "tavern_current_user",
        JSON.stringify(user)
      );
      localStorage.setItem(
        "tavern_username",
        user?.name || "Traveler"
      );

      navigate("/shop");
    } catch (err) {
      setServerError(err?.message || "Login failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-900/30 bg-gradient-to-br from-slate-950 via-purple-950/40 to-slate-950 p-8 text-center shadow-2xl shadow-purple-900/20">
        <span className="mb-4 block text-5xl">🏰</span>
        <h1 className="font-serif text-3xl font-bold text-amber-100">
          Welcome Back
        </h1>
        <p className="mt-2 font-serif text-sm italic text-amber-100/70">
          Sign in to continue your journey
        </p>

        <div className="mt-4 text-xs text-amber-100/60">
          Socket:{" "}
          <span
            className={
              isConnected ? "text-emerald-300" : "text-red-300"
            }
          >
            {isConnected ? "Connected" : "Disconnected"}
          </span>
        </div>
      </div>

      {/* Login Form */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-900/30 bg-gradient-to-br from-slate-950 to-purple-950/30 p-8 shadow-lg shadow-purple-900/20">
        {serverError && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div>
            <label className="mb-2 block font-serif text-sm font-semibold text-amber-100">
              Name
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter your name"
              autoComplete="username"
              className={`w-full rounded-lg border ${
                errors.name ? "border-red-500" : "border-amber-900/30"
              } bg-slate-950 px-4 py-3 font-serif text-sm text-amber-100 placeholder-amber-100/40 focus:outline-none focus:ring-2 ${
                errors.name
                  ? "focus:ring-red-500"
                  : "focus:ring-amber-600"
              }`}
            />
            {errors.name && (
              <p className="mt-1 font-serif text-xs text-red-400">
                {errors.name}
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="mb-2 block font-serif text-sm font-semibold text-amber-100">
              Password
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter your password"
              autoComplete="current-password"
              className={`w-full rounded-lg border ${
                errors.password
                  ? "border-red-500"
                  : "border-amber-900/30"
              } bg-slate-950 px-4 py-3 font-serif text-sm text-amber-100 placeholder-amber-100/40 focus:outline-none focus:ring-2 ${
                errors.password
                  ? "focus:ring-red-500"
                  : "focus:ring-amber-600"
              }`}
            />
            {errors.password && (
              <p className="mt-1 font-serif text-xs text-red-400">
                {errors.password}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="rounded border-amber-900/30 bg-slate-950 text-amber-600 focus:ring-amber-600"
              />
              <span className="font-serif text-xs text-amber-100/70">
                Remember me
              </span>
            </label>

            <Link
              to="/forgot-password"
              className="font-serif text-xs text-amber-400 hover:text-amber-300"
            >
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className={`w-full rounded-xl border border-amber-600/50 bg-gradient-to-r from-amber-950/50 to-purple-950/50 py-3 font-serif text-base font-bold text-amber-100 transition-all ${
              !canSubmit
                ? "cursor-not-allowed opacity-60"
                : "hover:border-amber-500"
            }`}
          >
            {isSubmitting ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="font-serif text-sm text-amber-100/70">
            Don&apos;t have an account?{" "}
            <Link
              to="/signup"
              className="font-semibold text-amber-400 hover:text-amber-300"
            >
              Create Account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
