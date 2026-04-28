// NanashiCollectibles/src/pages/LoginPage.jsx
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSocket } from "../../hooks/useSocket";
import { setCurrentUser, setUsername } from "../../authStorage";

const ROLES = {
  USER: "USER",
  VENDOR: "VENDOR",
  ADMIN: "ADMIN",
};

const ROLE_CONFIG = {
  [ROLES.USER]: {
    icon: "🧙",
    label: "Adventurer",
    description: "Shop & collect",
  },
  [ROLES.VENDOR]: {
    icon: "⚒️",
    label: "Merchant",
    description: "Manage listings",
  },
};

export default function LoginPage() {
  const navigate = useNavigate();
  const { connect, emitAccountLogin } = useSocket(null);

  const [formData, setFormData] = useState({
    identifier: "",
    password: "",
    role: ROLES.USER,
  });

  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const canSubmit = useMemo(
    () =>
      formData.identifier.trim().length > 0 &&
      formData.password.length > 0 &&
      (formData.role === ROLES.USER || formData.role === ROLES.VENDOR || formData.role === ROLES.ADMIN) &&
      !isSubmitting,
    [formData, isSubmitting],
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    const nextValue =
      name === "role" ? String(value || "").toUpperCase() : value;
    setFormData((prev) => ({ ...prev, [name]: nextValue }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
    setServerError("");
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.identifier.trim())
      newErrors.identifier = "Name or email is required";
    if (!formData.password) newErrors.password = "Password is required";
    if (![ROLES.USER, ROLES.VENDOR, ROLES.ADMIN].includes(formData.role))
      newErrors.role = "Please select a valid role";
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
      connect?.();
      const res = await emitAccountLogin({
        identifier: formData.identifier.trim(),
        password: formData.password,
      });

      if (!res?.success) {
        setServerError(res?.message || "Invalid name or password.");
        return;
      }

      const user = res.data;
      const accountRole = String(user?.role || "").toUpperCase();

      if (
        formData.role === ROLES.VENDOR &&
        accountRole !== ROLES.VENDOR &&
        accountRole !== ROLES.ADMIN
      ) {
        setServerError("This account is not a Merchant or Admin account.");
        return;
      }
      if (formData.role === ROLES.USER && accountRole === ROLES.ADMIN) {
        setServerError(
          "Please use the Merchant tab to sign in with this account.",
        );
        return;
      }

      setCurrentUser(user);
      setUsername(user?.name || "Traveler");
      window.dispatchEvent(new Event("tavern:authChanged"));

      if (accountRole === ROLES.ADMIN) navigate("/admin");
      else if (accountRole === ROLES.VENDOR) navigate("/vendor");
      else navigate("/shop");
    } catch (err) {
      setServerError(err?.message || "Login failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeConfig = ROLE_CONFIG[formData.role];

  return (
    <div className="mx-auto max-w-md space-y-4">
      {/* ── Header ── */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-900/30 bg-gradient-to-br from-slate-950 via-purple-950/40 to-slate-950 px-8 py-10 text-center shadow-2xl shadow-purple-900/20">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />

        <div className="relative inline-flex items-center justify-center">
          <div className="absolute h-20 w-20 rounded-full bg-amber-500/10 blur-xl" />
          <span className="relative text-6xl drop-shadow-lg">🏰</span>
        </div>

        <h1 className="mt-4 font-serif text-3xl font-bold tracking-wide text-amber-100">
          Welcome Back
        </h1>
        <p className="mt-1 font-serif text-sm italic text-amber-100/60">
          Sign in to continue your journey
        </p>

        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
      </div>

      {/* ── Form Card ── */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-900/30 bg-gradient-to-br from-slate-950 to-purple-950/20 p-8 shadow-xl shadow-purple-900/20">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />

        {serverError && (
          <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            <span className="mt-0.5 shrink-0">⚠️</span>
            <span>{serverError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Role picker */}
          <div>
            <label className="mb-2 block font-serif text-xs font-semibold uppercase tracking-widest text-amber-100/60">
              Sign in as
            </label>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(ROLE_CONFIG).map(([roleKey, cfg]) => (
                <label
                  key={roleKey}
                  className={`group relative cursor-pointer overflow-hidden rounded-xl border px-4 py-3 transition-all duration-200 ${
                    formData.role === roleKey
                      ? "border-amber-500/60 bg-amber-950/40 shadow-lg shadow-amber-900/20"
                      : "border-amber-900/30 bg-slate-950/60 hover:border-amber-700/50 hover:bg-slate-900/80"
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={roleKey}
                    checked={formData.role === roleKey}
                    onChange={handleChange}
                    className="sr-only"
                  />
                  {formData.role === roleKey && (
                    <span className="absolute right-2 top-2 text-xs text-amber-400">✓</span>
                  )}
                  <span className="text-xl">{cfg.icon}</span>
                  <p className="mt-1 font-serif text-sm font-semibold text-amber-100">
                    {cfg.label}
                  </p>
                  <p className="text-xs text-amber-100/50">{cfg.description}</p>
                </label>
              ))}
            </div>
            {errors.role && (
              <p className="mt-1 font-serif text-xs text-red-400">{errors.role}</p>
            )}
          </div>

          {/* Identifier */}
          <div>
            <label className="mb-2 block font-serif text-xs font-semibold uppercase tracking-widest text-amber-100/60">
              {formData.role === ROLES.VENDOR ? "Merchant name or email" : "Name or email"}
            </label>
            <input
              type="text"
              name="identifier"
              value={formData.identifier}
              onChange={handleChange}
              placeholder={
                formData.role === ROLES.VENDOR
                  ? "Enter your merchant name or email"
                  : "Enter your name or email"
              }
              autoComplete="username"
              className={`w-full rounded-xl border ${
                errors.identifier ? "border-red-500/70" : "border-amber-900/30"
              } bg-slate-900/80 px-4 py-3 font-serif text-sm text-amber-100 placeholder-amber-100/30 transition focus:border-amber-600/50 focus:outline-none focus:ring-1 ${
                errors.identifier ? "focus:ring-red-500/50" : "focus:ring-amber-600/30"
              }`}
            />
            {errors.identifier && (
              <p className="mt-1 font-serif text-xs text-red-400">{errors.identifier}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="font-serif text-xs font-semibold uppercase tracking-widest text-amber-100/60">
                Password
              </label>
              <Link
                to="/forgot-password"
                className="font-serif text-xs text-amber-400/70 transition hover:text-amber-300"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter your password"
                autoComplete="current-password"
                className={`w-full rounded-xl border ${
                  errors.password ? "border-red-500/70" : "border-amber-900/30"
                } bg-slate-900/80 px-4 py-3 pr-11 font-serif text-sm text-amber-100 placeholder-amber-100/30 transition focus:border-amber-600/50 focus:outline-none focus:ring-1 ${
                  errors.password ? "focus:ring-red-500/50" : "focus:ring-amber-600/30"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-100/40 transition hover:text-amber-100/80"
                tabIndex={-1}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 font-serif text-xs text-red-400">{errors.password}</p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!canSubmit}
            className={`relative w-full overflow-hidden rounded-xl border py-3.5 font-serif text-base font-bold text-amber-100 transition-all duration-200 ${
              canSubmit
                ? "border-amber-600/50 bg-gradient-to-r from-amber-950/60 to-purple-950/60 shadow-lg shadow-amber-900/20 hover:border-amber-500/80 hover:shadow-amber-500/20"
                : "cursor-not-allowed border-amber-900/20 bg-slate-950/50 opacity-50"
            }`}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-100/30 border-t-amber-100" />
                Signing in…
              </span>
            ) : (
              <span>
                {activeConfig.icon} Enter the Tavern
              </span>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="font-serif text-sm text-amber-100/50">
            Don&apos;t have an account?{" "}
            <Link
              to="/signup"
              className="font-semibold text-amber-400 transition hover:text-amber-300"
            >
              Create Account
            </Link>
          </p>
        </div>

        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />
      </div>
    </div>
  );
}
