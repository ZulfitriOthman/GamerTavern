// NanashiCollectibles/src/pages/SignUpPage.jsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSocket } from "../../hooks/useSocket";
import { setCurrentUser, setUsername } from "../../authStorage";

const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const disposableDomains = [
  "mailinator.com",
  "10minutemail.com",
  "guerrillamail.com",
  "tempmail.com",
  "yopmail.com",
  "trashmail.com",
  "fakeinbox.com",
  "getnada.com",
];

const PHONE_RULES = {
  "+673": { groups: [3, 4], min: 7, max: 7 },
  "+60": { groups: [2, 3, 4], min: 9, max: 10 },
  "+65": { groups: [4, 4], min: 8, max: 8 },
  "+62": { groups: [3, 4, 4], min: 9, max: 12 },
  "+63": { groups: [3, 3, 4], min: 10, max: 10 },
  "+66": { groups: [2, 3, 4], min: 9, max: 9 },
  "+84": { groups: [3, 3, 4], min: 9, max: 10 },
  "+91": { groups: [5, 5], min: 10, max: 10 },
  "+86": { groups: [3, 4, 4], min: 11, max: 11 },
  "+81": { groups: [2, 4, 4], min: 10, max: 10 },
  "+82": { groups: [2, 4, 4], min: 9, max: 10 },
  "+61": { groups: [3, 3, 3], min: 9, max: 9 },
  "+44": { groups: [4, 3, 3], min: 10, max: 10 },
  "+1": { groups: [3, 3, 4], min: 10, max: 10 },
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

function getFlagEmoji(code) {
  return String(code || "")
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

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
  const { connect, isConnected, emitAccountCreate, emitCountryList } =
    useSocket(null);

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

  useEffect(() => {
    connect?.("guest");
  }, [connect]);

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
      }));

      setCountries(mapped);
      setPhoneCountry((prev) => prev ?? mapped[0]);
      setCountriesLoading(false);
    });

    return () => {
      cancelled = true;
    };
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
    let nextValue = name === "role" ? String(value || "").toUpperCase() : value;

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
      if (!lower) {
        setErrors((prev) => ({ ...prev, email: "Email is required" }));
      } else if (!emailRegex.test(lower)) {
        setErrors((prev) => ({ ...prev, email: "Email is invalid" }));
      } else if (disposableDomains.some((d) => lower.endsWith("@" + d))) {
        setErrors((prev) => ({
          ...prev,
          email: "Disposable email addresses are not allowed",
        }));
      }
    }

    if (name === "phone" && isVendor) {
      const localDigits = value.replace(/\D/g, "");
      if (!localDigits) {
        setErrors((prev) => ({ ...prev, phone: "Phone is required for merchants" }));
      } else if (localDigits.length < phoneRule.min) {
        setErrors((prev) => ({
          ...prev,
          phone: `Phone must be at least ${phoneRule.min} digits`,
        }));
      } else if (localDigits.length > phoneRule.max) {
        setErrors((prev) => ({
          ...prev,
          phone: `Phone must be at most ${phoneRule.max} digits`,
        }));
      } else if (/^0+$/.test(localDigits)) {
        setErrors((prev) => ({ ...prev, phone: "Phone number cannot be all zeros" }));
      }
    } else if (name === "phone" && value.replace(/\D/g, "")) {
      const localDigits = value.replace(/\D/g, "");
      if (
        localDigits.length < phoneRule.min ||
        localDigits.length > phoneRule.max ||
        /^0+$/.test(localDigits)
      ) {
        setErrors((prev) => ({
          ...prev,
          phone: `Enter ${
            phoneRule.min === phoneRule.max
              ? phoneRule.min
              : `${phoneRule.min}-${phoneRule.max}`
          } digits`,
        }));
      }
    }

    if (name === "password") {
      if (!value) {
        setErrors((prev) => ({ ...prev, password: "Password is required" }));
      } else if (!passwordRegex.test(value)) {
        setErrors((prev) => ({
          ...prev,
          password:
            "Must be 8+ chars, include uppercase, lowercase, a number & a special character",
        }));
      }
    }

    if (name === "confirmPassword" && value !== formData.password) {
      setErrors((prev) => ({ ...prev, confirmPassword: "Passwords do not match" }));
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.username.trim()) {
      newErrors.username = "Username is required";
    } else if (formData.username.trim().length < 3) {
      newErrors.username = "Username must be at least 3 characters";
    }

    const email = formData.email.trim().toLowerCase();
    if (!email) {
      newErrors.email = "Email is required";
    } else if (!emailRegex.test(email)) {
      newErrors.email = "Email is invalid";
    } else if (disposableDomains.some((d) => email.endsWith("@" + d))) {
      newErrors.email = "Disposable email addresses are not allowed";
    }

    const phoneDigits = formData.phone.replace(/\D/g, "");
    if (isVendor) {
      if (!phoneDigits) {
        newErrors.phone = "Phone is required for merchants";
      } else if (phoneDigits.length < phoneRule.min) {
        newErrors.phone = `Phone must be at least ${phoneRule.min} digits`;
      } else if (phoneDigits.length > phoneRule.max) {
        newErrors.phone = `Phone must be at most ${phoneRule.max} digits`;
      } else if (/^0+$/.test(phoneDigits)) {
        newErrors.phone = "Phone number cannot be all zeros";
      }
    } else if (
      phoneDigits &&
      (phoneDigits.length < phoneRule.min ||
        phoneDigits.length > phoneRule.max ||
        /^0+$/.test(phoneDigits))
    ) {
      newErrors.phone = `Enter ${
        phoneRule.min === phoneRule.max
          ? phoneRule.min
          : `${phoneRule.min}-${phoneRule.max}`
      } digits`;
    }

    if (![ROLES.USER, ROLES.VENDOR].includes(formData.role)) {
      newErrors.role = "Please select a valid role";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (!passwordRegex.test(formData.password)) {
      newErrors.password =
        "Password must be at least 8 characters, include a lowercase, uppercase, a number, and a special character.";
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
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
      connect?.(formData.username.trim());
      const res = await emitAccountCreate({
        name: formData.username.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone
          ? (phoneCountry?.dial ?? "") + formData.phone.replace(/\D/g, "")
          : null,
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
              {cfg.headerIcon}
            </div>

            <h1 className="mt-6 font-serif text-4xl font-black uppercase tracking-[0.08em] text-white sm:text-[2.65rem]">
              {cfg.headerTitle}
            </h1>

            <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/65">
              {cfg.headerSub}. Create your credentials and unlock marketplace
              access in one step.
            </p>

            <div className="mt-8 space-y-3">
              <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3">
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-purple-200/70">
                  Account Mode
                </p>
                <p className="mt-1 font-serif text-lg font-bold uppercase tracking-[0.08em] text-white">
                  {cfg.label}
                </p>
                <p className="text-xs text-white/55">{cfg.description}</p>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3">
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-200/70">
                  Security Notice
                </p>
                <p className="mt-1 text-sm text-white/70">
                  Strong passwords are required before account activation.
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
            <div
              className={`rounded-xl border border-red-500/50 bg-red-950/30 px-4 py-3 text-sm text-red-100 transition-all duration-300 ${
                Object.values(errors).some(Boolean)
                  ? "opacity-100"
                  : "pointer-events-none max-h-0 overflow-hidden border-transparent bg-transparent p-0 opacity-0"
              }`}
            >
              <ul className="list-disc space-y-1 pl-5">
                {Object.entries(errors).map(([key, msg]) =>
                  msg ? <li key={key}>{msg}</li> : null,
                )}
              </ul>
            </div>

            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.22em] text-white/60">
                Account type
              </label>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(ROLE_CONFIG).map(([roleKey, roleCfg]) => (
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
                    <span className="text-xl">{roleCfg.icon}</span>
                    <p className="mt-1 font-serif text-sm font-semibold text-white">
                      {roleCfg.label}
                    </p>
                    <p className="text-xs text-white/55">{roleCfg.description}</p>
                  </label>
                ))}
              </div>
              {errors.role && <p className="mt-1 text-xs text-red-300">{errors.role}</p>}
            </div>

            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.22em] text-white/60">
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
                <p className="mt-1 text-xs text-red-300">{errors.username}</p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.22em] text-white/60">
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
              {errors.email && <p className="mt-1 text-xs text-red-300">{errors.email}</p>}
            </div>

            {isVendor && (
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.22em] text-white/60">
                  Phone <span className="text-red-400">*</span>
                </label>
                <div className="flex gap-2">
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowCountryPicker((v) => !v)}
                      onBlur={() => setTimeout(() => setShowCountryPicker(false), 150)}
                      disabled={countriesLoading}
                      className="flex h-full min-w-[6rem] items-center gap-1.5 rounded-xl border border-white/15 bg-black/35 px-3 py-3 font-serif text-sm text-white transition hover:border-purple-300/45 focus:outline-none focus:ring-2 focus:ring-purple-400/25 disabled:opacity-50"
                    >
                      {countriesLoading ? (
                        <span className="text-xs text-white/45">...</span>
                      ) : (
                        <>
                          <span className="text-base leading-none">{phoneCountry?.flag}</span>
                          <span className="text-white/70">{phoneCountry?.dial}</span>
                          <span className="ml-auto text-[10px] text-white/40">▾</span>
                        </>
                      )}
                    </button>

                    {showCountryPicker && (
                      <div className="absolute left-0 top-full z-20 mt-1 max-h-52 w-56 overflow-y-auto rounded-xl border border-white/15 bg-slate-950 shadow-2xl shadow-black/50">
                        {countries.map((c) => (
                          <button
                            key={c.name}
                            type="button"
                            onMouseDown={() => {
                              setPhoneCountry(c);
                              setShowCountryPicker(false);
                              setErrors((prev) => ({ ...prev, phone: "" }));
                              const newMax = getPhoneRule(c.dial).max;
                              setFormData((prev) => ({
                                ...prev,
                                phone: prev.phone.slice(0, newMax),
                              }));
                            }}
                            className={`flex w-full items-center gap-2 px-3 py-2 text-left font-serif text-sm transition hover:bg-purple-500/10 ${
                              phoneCountry?.name === c.name
                                ? "text-purple-200"
                                : "text-white"
                            }`}
                          >
                            <span className="text-base">{c.flag}</span>
                            <span className="flex-1 truncate">{c.name}</span>
                            <span className="text-xs text-white/40">{c.dial}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

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
                  <p className="mt-1 text-xs text-red-300">{errors.phone}</p>
                ) : (
                  <p className="mt-1 text-xs text-white/45">
                    {phoneCountry?.dial} - {phoneRule.min === phoneRule.max
                      ? `${phoneRule.min} digits`
                      : `${phoneRule.min}-${phoneRule.max} digits`}
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.22em] text-white/60">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="8+ chars, upper, lower, number and special"
                  autoComplete="new-password"
                  className={inputClass(errors.password) + " pr-11"}
                  onBlur={handleBlur}
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

              <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg border border-white/10 bg-black/35 px-3 py-2">
                {[
                  { label: "8+ characters", met: formData.password.length >= 8 },
                  { label: "Uppercase letter", met: /[A-Z]/.test(formData.password) },
                  { label: "Lowercase letter", met: /[a-z]/.test(formData.password) },
                  { label: "Number", met: /\d/.test(formData.password) },
                  {
                    label: "Special character",
                    met: /[^A-Za-z0-9]/.test(formData.password),
                  },
                ].map(({ label, met }) => (
                  <li
                    key={label}
                    className={`flex items-center gap-1.5 font-serif text-xs transition-colors ${
                      met ? "text-emerald-300" : "text-white/45"
                    }`}
                  >
                    <span
                      className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px] ${
                        met
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-slate-900 text-white/45"
                      }`}
                    >
                      {met ? "✓" : "○"}
                    </span>
                    {label}
                  </li>
                ))}
              </ul>

              {errors.password && (
                <p className="mt-1 text-xs text-red-300">{errors.password}</p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.22em] text-white/60">
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/45 transition hover:text-white/90"
                  tabIndex={-1}
                >
                  {showConfirm ? "🙈" : "👁️"}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="mt-1 text-xs text-red-300">{errors.confirmPassword}</p>
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
                  Creating account...
                </span>
              ) : (
                <span className="relative">
                  {cfg.icon} {isVendor ? "Open My Shop" : "Begin My Journey"}
                </span>
              )}
            </button>
          </form>

          <div className="relative z-10 mt-6 text-center">
            <p className="text-sm text-white/55">
              Already have an account?{" "}
              <Link
                to="/login"
                className="font-semibold text-purple-200 transition hover:text-purple-100"
              >
                Sign In
              </Link>
            </p>
          </div>

          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-300/35 to-transparent" />
        </section>
      </div>
    </div>
  );
}
