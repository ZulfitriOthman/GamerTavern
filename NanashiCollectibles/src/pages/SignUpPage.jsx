// src/pages/SignUpPage.jsx
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSocket } from "../hooks/useSocket";
import { register } from "../api/auth";
import { tokenStore } from "../api/token";

const emailRegex = /\S+@\S+\.\S+/;

export default function SignUpPage() {
  const navigate = useNavigate();
  /* "is emitAccountCreate and connect unused????" - Zb
  const { isConnected, emitAccountCreate, connect } = useSocket(null);
  */
  const { isConnected } = useSocket(null);

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    phone: "+673",
    password: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = useMemo(() => {
    return (
      formData.username.trim().length >= 3 &&
      emailRegex.test(formData.email.trim()) &&
      formData.password.length >= 6 &&
      formData.password === formData.confirmPassword &&
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

    if (!formData.username.trim()) newErrors.username = "Username is required";
    else if (formData.username.trim().length < 3)
      newErrors.username = "Username must be at least 3 characters";

    if (!formData.email.trim()) newErrors.email = "Email is required";
    else if (!emailRegex.test(formData.email.trim()))
      newErrors.email = "Email is invalid";

    // phone optional, but keep it reasonable
    if (formData.phone && !/^\+\d{6,15}$/.test(formData.phone.trim())) {
      newErrors.phone =
        "Phone must be in international format e.g. +673xxxxxxx";
    }

    if (!formData.password) newErrors.password = "Password is required";
    else if (formData.password.length < 6)
      newErrors.password = "Password must be at least 6 characters";

    if (formData.password !== formData.confirmPassword)
      newErrors.confirmPassword = "Passwords do not match";

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
      // Ensure socket is connected (optional but helpful)
      connect(formData.username.trim());

      const payload = {
        name: formData.username.trim(), // backend expects "name"
        email: formData.email.trim().toLowerCase(),
        phone: (formData.phone || "+673").trim(),
        password: formData.password,
      };

      const res = await register(payload); // HTTP call
      
      // const res = await emitAccountCreate(payload);

      // Save JWT + user locally
      tokenStore.set(res.token);
      localStorage.setItem("tavern_current_user", JSON.stringify(res.user));
      localStorage.setItem("tavern_username", res.user?.NAME || payload.name);
      
      /* Testing
      if (!res?.success) {
        setServerError(res?.message || "Failed to create account.");
        return;
      }
      */

      // move user to login or home
      navigate("/");
    } catch (err) {
      setServerError(err.message || "Failed to create account.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-900/30 bg-gradient-to-br from-slate-950 via-purple-950/40 to-slate-950 p-8 text-center shadow-2xl shadow-purple-900/20">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
        <span className="mb-4 block text-5xl">⚔️</span>
        <h1 className="font-serif text-3xl font-bold text-amber-100">
          Join the Tavern
        </h1>
        <p className="mt-2 font-serif text-sm italic text-amber-100/70">
          Create your account and start your collection
        </p>

        <div className="mt-4 text-xs text-amber-100/60">
          Socket:{" "}
          <span className={isConnected ? "text-emerald-300" : "text-red-300"}>
            {isConnected ? "Connected" : "Disconnected"}
          </span>
        </div>

        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
      </div>

      {/* Form */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-900/30 bg-gradient-to-br from-slate-950 to-purple-950/30 p-8 shadow-lg shadow-purple-900/20">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />

        {serverError ? (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            {serverError}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Username */}
          <div>
            <label className="mb-2 block font-serif text-sm font-semibold text-amber-100">
              Username
            </label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="Enter your username"
              autoComplete="username"
              className={`w-full rounded-lg border ${
                errors.username ? "border-red-500" : "border-amber-900/30"
              } bg-slate-950 px-4 py-3 font-serif text-sm text-amber-100 placeholder-amber-100/40 focus:outline-none focus:ring-2 ${
                errors.username ? "focus:ring-red-500" : "focus:ring-amber-600"
              }`}
            />
            {errors.username ? (
              <p className="mt-1 font-serif text-xs text-red-400">
                {errors.username}
              </p>
            ) : null}
          </div>

          {/* Email */}
          <div>
            <label className="mb-2 block font-serif text-sm font-semibold text-amber-100">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter your email"
              autoComplete="email"
              className={`w-full rounded-lg border ${
                errors.email ? "border-red-500" : "border-amber-900/30"
              } bg-slate-950 px-4 py-3 font-serif text-sm text-amber-100 placeholder-amber-100/40 focus:outline-none focus:ring-2 ${
                errors.email ? "focus:ring-red-500" : "focus:ring-amber-600"
              }`}
            />
            {errors.email ? (
              <p className="mt-1 font-serif text-xs text-red-400">
                {errors.email}
              </p>
            ) : null}
          </div>

          {/* Phone (optional) */}
          <div>
            <label className="mb-2 block font-serif text-sm font-semibold text-amber-100">
              Phone <span className="text-amber-100/50">(optional)</span>
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+673xxxxxxxx"
              autoComplete="tel"
              className={`w-full rounded-lg border ${
                errors.phone ? "border-red-500" : "border-amber-900/30"
              } bg-slate-950 px-4 py-3 font-serif text-sm text-amber-100 placeholder-amber-100/40 focus:outline-none focus:ring-2 ${
                errors.phone ? "focus:ring-red-500" : "focus:ring-amber-600"
              }`}
            />
            {errors.phone ? (
              <p className="mt-1 font-serif text-xs text-red-400">
                {errors.phone}
              </p>
            ) : null}
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
              autoComplete="new-password"
              className={`w-full rounded-lg border ${
                errors.password ? "border-red-500" : "border-amber-900/30"
              } bg-slate-950 px-4 py-3 font-serif text-sm text-amber-100 placeholder-amber-100/40 focus:outline-none focus:ring-2 ${
                errors.password ? "focus:ring-red-500" : "focus:ring-amber-600"
              }`}
            />
            {errors.password ? (
              <p className="mt-1 font-serif text-xs text-red-400">
                {errors.password}
              </p>
            ) : null}
          </div>

          {/* Confirm */}
          <div>
            <label className="mb-2 block font-serif text-sm font-semibold text-amber-100">
              Confirm Password
            </label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Confirm your password"
              autoComplete="new-password"
              className={`w-full rounded-lg border ${
                errors.confirmPassword
                  ? "border-red-500"
                  : "border-amber-900/30"
              } bg-slate-950 px-4 py-3 font-serif text-sm text-amber-100 placeholder-amber-100/40 focus:outline-none focus:ring-2 ${
                errors.confirmPassword
                  ? "focus:ring-red-500"
                  : "focus:ring-amber-600"
              }`}
            />
            {errors.confirmPassword ? (
              <p className="mt-1 font-serif text-xs text-red-400">
                {errors.confirmPassword}
              </p>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className={`w-full rounded-xl border border-amber-600/50 bg-gradient-to-r from-amber-950/50 to-purple-950/50 py-3 font-serif text-base font-bold text-amber-100 shadow-lg shadow-amber-900/30 transition-all hover:border-amber-500 hover:shadow-xl hover:shadow-amber-500/40 ${
              !canSubmit
                ? "cursor-not-allowed opacity-60 hover:shadow-none"
                : ""
            }`}
          >
            {isSubmitting ? "Creating..." : "Create Account"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="font-serif text-sm text-amber-100/70">
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-semibold text-amber-400 transition-colors hover:text-amber-300"
            >
              Sign In
            </Link>
          </p>
        </div>

        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
      </div>
    </div>
  );
}
