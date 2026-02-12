// NanashiCollectibles/src/pages/LoginPage.jsx
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSocket } from "../hooks/useSocket";

const ROLES = {
  USER: "USER",
  VENDOR: "VENDOR",
};

export default function LoginPage() {
  const navigate = useNavigate();

  // ✅ socket-only auth
  const { isConnected, connect, emitAccountLogin } = useSocket(null);

  const [formData, setFormData] = useState({
    name: "",
    password: "",
    role: ROLES.USER, // ✅ new
  });

  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = useMemo(() => {
    return (
      formData.name.trim().length >= 3 &&
      formData.password.length > 0 &&
      (formData.role === ROLES.USER || formData.role === ROLES.VENDOR) &&
      !isSubmitting
    );
  }, [formData, isSubmitting]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const nextValue = name === "role" ? String(value || "").toUpperCase() : value;

    setFormData((prev) => ({ ...prev, [name]: nextValue }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
    setServerError("");
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.name.trim()) newErrors.name = "Name is required";
    else if (formData.name.trim().length < 3)
      newErrors.name = "Name must be at least 3 characters";

    if (!formData.password) newErrors.password = "Password is required";

    if (![ROLES.USER, ROLES.VENDOR].includes(formData.role)) {
      newErrors.role = "Please select a valid role";
    }

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

      // ✅ IMPORTANT: enforce role at login UI level
      // If user selected VENDOR but account is USER -> reject
      if (formData.role === ROLES.VENDOR && user?.role !== ROLES.VENDOR) {
        setServerError("This account is not a Vendor account.");
        return;
      }

      // (Optional) if selected USER but account is VENDOR, you may still allow it
      // If you want strict, uncomment:
      // if (formData.role === ROLES.USER && user?.role !== ROLES.USER) {
      //   setServerError("This account is not a User account.");
      //   return;
      // }

      // ✅ store user
      localStorage.setItem("tavern_current_user", JSON.stringify(user));
      localStorage.setItem("tavern_username", user?.name || "Traveler");

      // ✅ notify App.jsx (same tab) so navbar updates without refresh
      window.dispatchEvent(new Event("tavern:authChanged"));

      // ✅ route based on role
      if (user?.role === ROLES.VENDOR) navigate("/vendor");
      else navigate("/shop");
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
          <span className={isConnected ? "text-emerald-300" : "text-red-300"}>
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
          {/* ✅ Role */}
          <div>
            <label className="mb-2 block font-serif text-sm font-semibold text-amber-100">
              Login as
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label
                className={`cursor-pointer rounded-xl border px-4 py-3 text-sm font-serif ${
                  formData.role === ROLES.USER
                    ? "border-amber-500/70 bg-amber-950/30 text-amber-100"
                    : "border-amber-900/30 bg-slate-950 text-amber-100/80 hover:border-amber-600/50"
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value={ROLES.USER}
                  checked={formData.role === ROLES.USER}
                  onChange={handleChange}
                  className="mr-2 accent-amber-500"
                />
                User
                <div className="mt-1 text-xs text-amber-100/60">
                  Shop & collect
                </div>
              </label>

              <label
                className={`cursor-pointer rounded-xl border px-4 py-3 text-sm font-serif ${
                  formData.role === ROLES.VENDOR
                    ? "border-amber-500/70 bg-amber-950/30 text-amber-100"
                    : "border-amber-900/30 bg-slate-950 text-amber-100/80 hover:border-amber-600/50"
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value={ROLES.VENDOR}
                  checked={formData.role === ROLES.VENDOR}
                  onChange={handleChange}
                  className="mr-2 accent-amber-500"
                />
                Vendor
                <div className="mt-1 text-xs text-amber-100/60">
                  Manage listings
                </div>
              </label>
            </div>

            {errors.role && (
              <p className="mt-1 font-serif text-xs text-red-400">{errors.role}</p>
            )}
          </div>

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
                errors.name ? "focus:ring-red-500" : "focus:ring-amber-600"
              }`}
            />
            {errors.name && (
              <p className="mt-1 font-serif text-xs text-red-400">{errors.name}</p>
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
                errors.password ? "border-red-500" : "border-amber-900/30"
              } bg-slate-950 px-4 py-3 font-serif text-sm text-amber-100 placeholder-amber-100/40 focus:outline-none focus:ring-2 ${
                errors.password ? "focus:ring-red-500" : "focus:ring-amber-600"
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
