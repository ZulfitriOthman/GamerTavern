// NanashiCollectibles/src/pages/SignUpPage.jsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSocket } from "../../hooks/useSocket";
import { setCurrentUser, setUsername } from "../../authStorage";


// Email: must be valid and not disposable (basic check)
const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const disposableDomains = [
  "mailinator.com", "10minutemail.com", "guerrillamail.com", "tempmail.com", "yopmail.com", "trashmail.com", "fakeinbox.com", "getnada.com"
];

// Phone: must be international format, not all zeros
const phoneRegex = /^\+\d{6,15}$/;

// Per-country phone rules: groups = digit cluster sizes for auto-spacing
const PHONE_RULES = {
  "+673": { groups: [3, 4],    min: 7,  max: 7  }, // Brunei
  "+60":  { groups: [2, 3, 4], min: 9,  max: 10 }, // Malaysia
  "+65":  { groups: [4, 4],    min: 8,  max: 8  }, // Singapore
  "+62":  { groups: [3, 4, 4], min: 9,  max: 12 }, // Indonesia
  "+63":  { groups: [3, 3, 4], min: 10, max: 10 }, // Philippines
  "+66":  { groups: [2, 3, 4], min: 9,  max: 9  }, // Thailand
  "+84":  { groups: [3, 3, 4], min: 9,  max: 10 }, // Vietnam
  "+91":  { groups: [5, 5],    min: 10, max: 10 }, // India
  "+86":  { groups: [3, 4, 4], min: 11, max: 11 }, // China
  "+81":  { groups: [2, 4, 4], min: 10, max: 10 }, // Japan
  "+82":  { groups: [2, 4, 4], min: 9,  max: 10 }, // South Korea
  "+61":  { groups: [3, 3, 3], min: 9,  max: 9  }, // Australia
  "+44":  { groups: [4, 3, 3], min: 10, max: 10 }, // United Kingdom
  "+1":   { groups: [3, 3, 4], min: 10, max: 10 }, // United States
};
const DEFAULT_PHONE_RULE = { groups: [4, 4, 4], min: 6, max: 15 };

function getPhoneRule(dial) {
  return PHONE_RULES[dial] || DEFAULT_PHONE_RULE;
}

function formatPhone(digits, groups) {
  const out = [];
  let i = 0;
  for (const g of groups) {
    if (i >= digits.length) break;
    out.push(digits.slice(i, i + g));
    i += g;
  }
  if (i < digits.length) out.push(digits.slice(i));
  return out.join(" ");
}

function makePhonePlaceholder(groups) {
  return groups.map((n) => "x".repeat(n)).join(" ");
}

// Convert ISO-2 country code (e.g. "BN") to flag emoji
function getFlagEmoji(code) {
  return String(code || "")
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

// Password: at least 8 chars, 1 lowercase, 1 uppercase, 1 number, 1 special
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

const ROLES = {
  USER: "USER",
  VENDOR: "VENDOR",
};

const ROLE_CONFIG = {
  [ROLES.USER]: {
    icon: "🧙",
    label: "Adventurer",
    description: "Buy, browse & collect",
    headerIcon: "⚔️",
    headerTitle: "Join the Tavern",
    headerSub: "Start your collection journey",
  },
  [ROLES.VENDOR]: {
    icon: "⚒️",
    label: "Merchant",
    description: "Sell items & manage listings",
    headerIcon: "🏪",
    headerTitle: "Open Your Shop",
    headerSub: "Start selling to the community",
  },
};

export default function SignUpPage() {
  const navigate = useNavigate();
  const { connect, isConnected, emitAccountCreate, emitCountryList } = useSocket(null);

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    phone: "",
    role: ROLES.USER,
    password: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [countries, setCountries] = useState([]);
  const [countriesLoading, setCountriesLoading] = useState(true);
  const [phoneCountry, setPhoneCountry] = useState(null);
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  // Connect socket on mount so we can fetch countries
  useEffect(() => {
    connect?.("guest");
  }, [connect]);

  // Fetch countries via socket once connected
  useEffect(() => {
    if (!isConnected) return;
    let cancelled = false;
    emitCountryList().then((res) => {
      if (cancelled) return;
      const rows = res?.data;
      if (!Array.isArray(rows) || rows.length === 0) {
        setCountriesLoading(false);
        return;
      }
      const mapped = rows.map((r) => ({
        flag: getFlagEmoji(r.code),
        name: r.name,
        dial: r.dial,
        placeholder: "xxxxxxxx",
      }));
      setCountries(mapped);
      setPhoneCountry((prev) => prev ?? mapped[0]);
      setCountriesLoading(false);
    });
    return () => { cancelled = true; };
  }, [isConnected, emitCountryList]);

  const isVendor = formData.role === ROLES.VENDOR;

  const phoneRule = getPhoneRule(phoneCountry?.dial);

  const canSubmit = useMemo(() => {
    const dial = phoneCountry?.dial ?? "";
    const localDigits = formData.phone.replace(/\D/g, "");
    const phoneOk =
      !isVendor ||
      (!!dial &&
        localDigits.length >= phoneRule.min &&
        localDigits.length <= phoneRule.max &&
        !/^0+$/.test(localDigits));
    return (
      formData.username.trim().length >= 3 &&
      emailRegex.test(formData.email.trim()) &&
      passwordRegex.test(formData.password) &&
      formData.password === formData.confirmPassword &&
      (formData.role === ROLES.USER || formData.role === ROLES.VENDOR) &&
      phoneOk &&
      !isSubmitting
    );
  }, [formData, isSubmitting, isVendor, phoneCountry, phoneRule]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    let nextValue =
      name === "role" ? String(value || "").toUpperCase() : value;
    if (name === "phone") {
      const digits = value.replace(/\D/g, "").slice(0, phoneRule.max);
      nextValue = digits;
    }
    setFormData((prev) => ({ ...prev, [name]: nextValue }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
    setServerError("");
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    const trimmed = value.trim();

    if (name === "email") {
      const lower = trimmed.toLowerCase();
      if (!lower) setErrors((prev) => ({ ...prev, email: "Email is required" }));
      else if (!emailRegex.test(lower)) setErrors((prev) => ({ ...prev, email: "Email is invalid" }));
      else if (disposableDomains.some((d) => lower.endsWith("@" + d))) setErrors((prev) => ({ ...prev, email: "Disposable email addresses are not allowed" }));
    }

    if (name === "phone" && isVendor) {
      const localDigits = value.replace(/\D/g, "");
      if (!localDigits) setErrors((prev) => ({ ...prev, phone: "Phone is required for merchants" }));
      else if (localDigits.length < phoneRule.min) setErrors((prev) => ({ ...prev, phone: `Phone must be at least ${phoneRule.min} digits` }));
      else if (localDigits.length > phoneRule.max) setErrors((prev) => ({ ...prev, phone: `Phone must be at most ${phoneRule.max} digits` }));
      else if (/^0+$/.test(localDigits)) setErrors((prev) => ({ ...prev, phone: "Phone number cannot be all zeros" }));
    } else if (name === "phone" && value.replace(/\D/g, "")) {
      const localDigits = value.replace(/\D/g, "");
      if (localDigits.length < phoneRule.min || localDigits.length > phoneRule.max || /^0+$/.test(localDigits)) {
        setErrors((prev) => ({ ...prev, phone: `Enter ${phoneRule.min === phoneRule.max ? phoneRule.min : `${phoneRule.min}-${phoneRule.max}`} digits` }));
      }
    }

    if (name === "password") {
      if (!value) setErrors((prev) => ({ ...prev, password: "Password is required" }));
      else if (!passwordRegex.test(value)) setErrors((prev) => ({ ...prev, password: "Must be 8+ chars, include uppercase, lowercase, a number & a special character" }));
    }

    if (name === "confirmPassword") {
      if (value !== formData.password) setErrors((prev) => ({ ...prev, confirmPassword: "Passwords do not match" }));
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.username.trim()) newErrors.username = "Username is required";
    else if (formData.username.trim().length < 3)
      newErrors.username = "Username must be at least 3 characters";

    // Email validation
    const email = formData.email.trim().toLowerCase();
    if (!email) newErrors.email = "Email is required";
    else if (!emailRegex.test(email)) newErrors.email = "Email is invalid";
    else if (disposableDomains.some((d) => email.endsWith("@" + d))) newErrors.email = "Disposable email addresses are not allowed";

    // Phone validation
    const phoneDigits = formData.phone.replace(/\D/g, "");
    if (isVendor) {
      if (!phoneDigits) newErrors.phone = "Phone is required for merchants";
      else if (phoneDigits.length < phoneRule.min) newErrors.phone = `Phone must be at least ${phoneRule.min} digits`;
      else if (phoneDigits.length > phoneRule.max) newErrors.phone = `Phone must be at most ${phoneRule.max} digits`;
      else if (/^0+$/.test(phoneDigits)) newErrors.phone = "Phone number cannot be all zeros";
    } else if (phoneDigits && (phoneDigits.length < phoneRule.min || phoneDigits.length > phoneRule.max || /^0+$/.test(phoneDigits))) {
      newErrors.phone = `Enter ${phoneRule.min === phoneRule.max ? phoneRule.min : `${phoneRule.min}-${phoneRule.max}`} digits`;
    }

    if (![ROLES.USER, ROLES.VENDOR].includes(formData.role)) newErrors.role = "Please select a valid role";

    // Password validation
    if (!formData.password) newErrors.password = "Password is required";
    else if (!passwordRegex.test(formData.password)) newErrors.password = "Password must be at least 8 characters, include a lowercase, uppercase, a number, and a special character.";

    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = "Passwords do not match";

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
      connect?.(formData.username.trim());
      const res = await emitAccountCreate({
        name: formData.username.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone ? (phoneCountry?.dial ?? "") + formData.phone.replace(/\D/g, "") : null,
        role: formData.role,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
      });

      if (!res?.success) {
        setServerError(res?.message || "Failed to create account.");
        return;
      }

      const user = res.data;
      setCurrentUser(user);
      setUsername(user?.name || formData.username.trim());
      window.dispatchEvent(new Event("tavern:authChanged"));
      navigate("/");
    } catch (err) {
      setServerError(err?.message || "Failed to create account.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const cfg = ROLE_CONFIG[formData.role];

  const inputClass = (hasError) =>
    `w-full rounded-xl border ${
      hasError ? "border-red-500/70" : "border-amber-900/30"
    } bg-slate-900/80 px-4 py-3 font-serif text-sm text-amber-100 placeholder-amber-100/30 transition focus:border-amber-600/50 focus:outline-none focus:ring-1 ${
      hasError ? "focus:ring-red-500/50" : "focus:ring-amber-600/30"
    }`;

  return (
    <div className="mx-auto max-w-md space-y-4">
      {/* ── Header ── */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-900/30 bg-gradient-to-br from-slate-950 via-purple-950/40 to-slate-950 px-8 py-10 text-center shadow-2xl shadow-purple-900/20">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />

        <div className="relative inline-flex items-center justify-center">
          <div className="absolute h-20 w-20 rounded-full bg-amber-500/10 blur-xl" />
          <span className="relative text-6xl drop-shadow-lg">{cfg.headerIcon}</span>
        </div>

        <h1 className="mt-4 font-serif text-3xl font-bold tracking-wide text-amber-100">
          {cfg.headerTitle}
        </h1>
        <p className="mt-1 font-serif text-sm italic text-amber-100/60">
          {cfg.headerSub}
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
          {/* Error summary */}
          <div
            className={`mb-3 min-h-[2.5rem] rounded-xl border border-red-500/50 bg-gradient-to-br from-red-900/70 to-red-950/80 px-4 py-3 text-sm text-red-200 transition-all duration-300 ${
              Object.values(errors).some(Boolean)
                ? 'opacity-100 scale-100'
                : 'opacity-0 scale-95 pointer-events-none'
            } animate-fadein`}
            style={{ minHeight: '2.5rem' }}
          >
            <ul className="list-disc pl-5 space-y-1">
              {Object.entries(errors).map(([key, msg]) =>
                msg ? <li key={key}>{msg}</li> : null
              )}
            </ul>
          </div>
          {/* Role picker */}
          <div>
            <label className="mb-2 block font-serif text-xs font-semibold uppercase tracking-widest text-amber-100/60">
              Account type
            </label>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(ROLE_CONFIG).map(([roleKey, roleCfg]) => (
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
                  <span className="text-xl">{roleCfg.icon}</span>
                  <p className="mt-1 font-serif text-sm font-semibold text-amber-100">
                    {roleCfg.label}
                  </p>
                  <p className="text-xs text-amber-100/50">{roleCfg.description}</p>
                </label>
              ))}
            </div>
            {errors.role && (
              <p className="mt-1 font-serif text-xs text-red-400">{errors.role}</p>
            )}
          </div>

          {/* Username */}
          <div>
            <label className="mb-2 block font-serif text-xs font-semibold uppercase tracking-widest text-amber-100/60">
              {isVendor ? "Merchant name" : "Username"}
            </label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder={isVendor ? "Your merchant display name" : "Choose a username"}
              autoComplete="username"
              className={inputClass(errors.username)}
            />
            {errors.username && (
              <p className="mt-1 font-serif text-xs text-red-400">{errors.username}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="mb-2 block font-serif text-xs font-semibold uppercase tracking-widest text-amber-100/60">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter your email address"
              autoComplete="email"
              className={inputClass(errors.email)}
              onBlur={handleBlur}
            />
            {errors.email && (
              <p className="mt-1 font-serif text-xs text-red-400">{errors.email}</p>
            )}
          </div>

          {/* Phone — required for vendor */}
          {isVendor && (
            <div>
              <label className="mb-2 block font-serif text-xs font-semibold uppercase tracking-widest text-amber-100/60">
                Phone <span className="text-red-400">*</span>
              </label>
              <div className="flex gap-2">
                {/* Country picker */}
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowCountryPicker((v) => !v)}
                    onBlur={() => setTimeout(() => setShowCountryPicker(false), 150)}
                    disabled={countriesLoading}
                    className="flex h-full min-w-[6rem] items-center gap-1.5 rounded-xl border border-amber-900/30 bg-slate-900/80 px-3 py-3 font-serif text-sm text-amber-100 transition hover:border-amber-700/50 focus:outline-none focus:ring-1 focus:ring-amber-600/30 disabled:opacity-50"
                  >
                    {countriesLoading ? (
                      <span className="text-amber-100/40 text-xs">…</span>
                    ) : (
                      <>
                        <span className="text-base leading-none">{phoneCountry?.flag}</span>
                        <span className="text-amber-100/70">{phoneCountry?.dial}</span>
                        <span className="ml-auto text-[10px] text-amber-100/40">▾</span>
                      </>
                    )}
                  </button>
                  {showCountryPicker && (
                    <div className="absolute left-0 top-full z-20 mt-1 max-h-52 w-56 overflow-y-auto rounded-xl border border-amber-900/30 bg-slate-900 shadow-2xl shadow-black/50">
                      {countries.map((c) => (
                        <button
                          key={c.name}
                          type="button"
                          onMouseDown={() => {
                            setPhoneCountry(c);
                            setShowCountryPicker(false);
                            setErrors((prev) => ({ ...prev, phone: "" }));
                            // truncate phone digits if they exceed new country's max
                            const newMax = getPhoneRule(c.dial).max;
                            setFormData((prev) => ({ ...prev, phone: prev.phone.slice(0, newMax) }));
                          }}
                          className={`flex w-full items-center gap-2 px-3 py-2 text-left font-serif text-sm transition hover:bg-amber-900/20 ${
                            phoneCountry?.name === c.name ? "text-amber-400" : "text-amber-100"
                          }`}
                        >
                          <span className="text-base">{c.flag}</span>
                          <span className="flex-1 truncate">{c.name}</span>
                          <span className="text-xs text-amber-100/40">{c.dial}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* Local number input */}
                <input
                  type="tel"
                  name="phone"
                  value={formatPhone(formData.phone, phoneRule.groups)}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder={makePhonePlaceholder(phoneRule.groups)}
                  inputMode="numeric"
                  maxLength={phoneRule.max + phoneRule.groups.length - 1}
                  autoComplete="tel-national"
                  className={inputClass(errors.phone) + " flex-1"}
                />
              </div>
              {errors.phone ? (
                <p className="mt-1 font-serif text-xs text-red-400">{errors.phone}</p>
              ) : (
                <p className="mt-1 font-serif text-xs text-amber-100/40">
                  {phoneCountry?.dial} — {phoneRule.min === phoneRule.max ? `${phoneRule.min} digits` : `${phoneRule.min}–${phoneRule.max} digits`}
                </p>
              )}
            </div>
          )}

          {/* Password */}
          <div>
            <label className="mb-2 block font-serif text-xs font-semibold uppercase tracking-widest text-amber-100/60">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="8+ chars, upper, lower, number & special"
                autoComplete="new-password"
                className={inputClass(errors.password) + " pr-11"}
                onBlur={handleBlur}
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
            {/* Password requirements checklist */}
            <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg border border-amber-900/20 bg-slate-950/40 px-3 py-2">
              {[
                { label: "8+ characters",     met: formData.password.length >= 8 },
                { label: "Uppercase letter",  met: /[A-Z]/.test(formData.password) },
                { label: "Lowercase letter",  met: /[a-z]/.test(formData.password) },
                { label: "Number",            met: /\d/.test(formData.password) },
                { label: "Special character", met: /[^A-Za-z0-9]/.test(formData.password) },
              ].map(({ label, met }) => (
                <li
                  key={label}
                  className={`flex items-center gap-1.5 font-serif text-xs transition-colors ${
                    met ? "text-emerald-400" : "text-amber-100/40"
                  }`}
                >
                  <span className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px] ${
                    met ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-800 text-amber-100/40"
                  }`}>
                    {met ? "✓" : "○"}
                  </span>
                  {label}
                </li>
              ))}
            </ul>
            {errors.password && (
              <p className="mt-1 font-serif text-xs text-red-400">{errors.password}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="mb-2 block font-serif text-xs font-semibold uppercase tracking-widest text-amber-100/60">
              Confirm password
            </label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Repeat your password"
                autoComplete="new-password"
                className={inputClass(errors.confirmPassword) + " pr-11"}
                onBlur={handleBlur}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-100/40 transition hover:text-amber-100/80"
                tabIndex={-1}
              >
                {showConfirm ? "🙈" : "👁️"}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="mt-1 font-serif text-xs text-red-400">{errors.confirmPassword}</p>
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
                Creating account…
              </span>
            ) : (
              <span>
                {cfg.icon} {isVendor ? "Open My Shop" : "Begin My Journey"}
              </span>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="font-serif text-sm text-amber-100/50">
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-semibold text-amber-400 transition hover:text-amber-300"
            >
              Sign In
            </Link>
          </p>
        </div>

        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />
      </div>
    </div>
  );
}

