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

      if (accountRole === ROLES.ADMIN) navigate("/vendor"); 
      else if (accountRole === ROLES.VENDOR) navigate("/vendor");
      else navigate("/shop");
    } catch (err) {
      setServerError(err?.message || "Login failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeConfig = ROLE_CONFIG[formData.role];
  const currentRoleUI =
    activeConfig ||
    ({
      icon: "✦",
      label: "Guardian",
      description: "Privileged access",
    });

  const inputClass = (hasError) =>
    `w-full rounded-xl border ${
      hasError ? "border-red-500/80" : "border-white/15"
    } bg-black/35 px-4 py-3 font-serif text-sm text-white placeholder-white/35 transition focus:border-purple-400/70 focus:outline-none focus:ring-2 ${
      hasError ? "focus:ring-red-500/35" : "focus:ring-purple-400/25"
    }`;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="grid gap-4 lg:grid-cols-[1.02fr_1.38fr]">
        <aside className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-black/75 via-purple-950/25 to-black/70 p-7 shadow-2xl shadow-purple-500/20 lg:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(167,139,250,0.24),transparent_46%),radial-gradient(circle_at_100%_100%,rgba(56,189,248,0.16),transparent_45%)]" />
          <div className="relative">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-xl border border-white/20 bg-purple-500/20 text-3xl shadow-[0_0_24px_rgba(168,85,247,0.35)]">
              🏰
            </div>

            <h1 className="mt-6 font-serif text-4xl font-black uppercase tracking-[0.08em] text-white sm:text-[2.65rem]">
              Tavern
              <span className="block text-purple-300">Access</span>
            </h1>

            <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/65">
              Re-enter your collector profile, sync your inventory, and jump
              back into live trading.
            </p>

            <div className="mt-8 space-y-3">
              <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3">
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-purple-200/70">
                  Active Channel
                </p>
                <p className="mt-1 font-serif text-lg font-bold uppercase tracking-[0.08em] text-white">
                  {currentRoleUI.label}
                </p>
                <p className="text-xs text-white/55">{currentRoleUI.description}</p>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3">
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-200/70">
                  Realm Notice
                </p>
                <p className="mt-1 text-sm text-white/70">
                  Merchant and admin profiles route to the vendor command deck.
                </p>
              </div>
            </div>
          </div>
        </aside>

        <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-black/80 via-slate-950/70 to-purple-950/30 p-6 shadow-2xl shadow-black/45 sm:p-8">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-300/45 to-transparent" />
          <div className="absolute -right-24 -top-24 h-60 w-60 rounded-full bg-purple-500/10 blur-3xl" />

          {serverError && (
            <div className="relative z-10 mb-5 flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-950/35 px-4 py-3 text-sm text-red-100">
              <span className="mt-0.5 shrink-0">⚠️</span>
              <span>{serverError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="relative z-10 space-y-5">
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.22em] text-white/60">
                Sign in as
              </label>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(ROLE_CONFIG).map(([roleKey, cfg]) => (
                  <label
                    key={roleKey}
                    className={`group relative cursor-pointer overflow-hidden rounded-xl border px-4 py-3 transition-all duration-200 ${
                      formData.role === roleKey
                        ? "border-purple-400/70 bg-purple-500/20 shadow-[0_0_26px_rgba(168,85,247,0.22)]"
                        : "border-white/15 bg-black/35 hover:border-purple-300/45 hover:bg-purple-500/10"
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
                      <span className="absolute right-2 top-2 text-xs text-purple-200">✓</span>
                    )}
                    <span className="text-xl">{cfg.icon}</span>
                    <p className="mt-1 font-serif text-sm font-semibold text-white">
                      {cfg.label}
                    </p>
                    <p className="text-xs text-white/55">{cfg.description}</p>
                  </label>
                ))}
              </div>
              {errors.role && (
                <p className="mt-1 text-xs text-red-300">{errors.role}</p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.22em] text-white/60">
                {formData.role === ROLES.VENDOR
                  ? "Merchant name or email"
                  : "Name or email"}
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
                className={inputClass(errors.identifier)}
              />
              {errors.identifier && (
                <p className="mt-1 text-xs text-red-300">{errors.identifier}</p>
              )}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-black uppercase tracking-[0.22em] text-white/60">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-semibold uppercase tracking-[0.12em] text-purple-200/80 transition hover:text-purple-100"
                >
                  Forgot?
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
                  className={inputClass(errors.password) + " pr-11"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/45 transition hover:text-white/90"
                  tabIndex={-1}
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-red-300">{errors.password}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className={`relative w-full overflow-hidden rounded-xl border py-3.5 font-serif text-base font-black uppercase tracking-[0.08em] text-white transition-all duration-200 ${
                canSubmit
                  ? "border-purple-300/50 bg-gradient-to-r from-purple-600/65 via-purple-500/60 to-cyan-500/45 shadow-[0_0_30px_rgba(168,85,247,0.3)] hover:border-purple-200/80"
                  : "cursor-not-allowed border-white/10 bg-white/5 opacity-50"
              }`}
            >
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 transition-opacity duration-300 hover:opacity-100" />
              {isSubmitting ? (
                <span className="relative flex items-center justify-center gap-2">
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                  Signing in...
                </span>
              ) : (
                <span className="relative">
                  {currentRoleUI.icon} Enter the Tavern
                </span>
              )}
            </button>
          </form>

          <div className="relative z-10 mt-6 text-center">
            <p className="text-sm text-white/55">
              Don&apos;t have an account?{" "}
              <Link
                to="/signup"
                className="font-semibold text-purple-200 transition hover:text-purple-100"
              >
                Create Account
              </Link>
            </p>
          </div>

          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-300/35 to-transparent" />
        </section>
      </div>
    </div>
  );
}
