// NanashiCollectibles/src/pages/ProfilePage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useSocket } from "../../hooks/useSocket";
import {
  getCurrentUser,
  setCurrentUser,
  setUsername,
} from "../../authStorage";

const API_BASE =
  String(import.meta.env.VITE_API_BASE || "").trim() ||
  String(import.meta.env.VITE_API_URL || "").trim() ||
  (typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1")
    ? "http://localhost:3002"
    : (typeof window !== "undefined" ? window.location.origin : ""));

function isImageUrl(value) {
  if (!value) return false;
  return /^(https?:\/\/|\/public\/|\/uploads\/|data:image)/i.test(value);
}

function resolveAvatarSrc(value) {
  if (!value) return "";
  if (/^https?:\/\//i.test(value) || value.startsWith("data:")) return value;
  if (value.startsWith("/")) return `${API_BASE}${value}`;
  return value;
}

// Phone validation regex (mirrors backend)
const phoneRegex = /^\+\d{6,15}$/;
const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

// Per-country phone rules (mirrors SignUpPage.jsx)
const PHONE_RULES = {
  "+673": { groups: [3, 4],    min: 7,  max: 7  },
  "+60":  { groups: [2, 3, 4], min: 9,  max: 10 },
  "+65":  { groups: [4, 4],    min: 8,  max: 8  },
  "+62":  { groups: [3, 4, 4], min: 9,  max: 12 },
  "+63":  { groups: [3, 3, 4], min: 10, max: 10 },
  "+66":  { groups: [2, 3, 4], min: 9,  max: 9  },
  "+84":  { groups: [3, 3, 4], min: 9,  max: 10 },
  "+91":  { groups: [5, 5],    min: 10, max: 10 },
  "+86":  { groups: [3, 4, 4], min: 11, max: 11 },
  "+81":  { groups: [2, 4, 4], min: 10, max: 10 },
  "+82":  { groups: [2, 4, 4], min: 9,  max: 10 },
  "+61":  { groups: [3, 3, 3], min: 9,  max: 9  },
  "+44":  { groups: [4, 3, 3], min: 10, max: 10 },
  "+1":   { groups: [3, 3, 4], min: 10, max: 10 },
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

// Split a stored phone like "+6737123456" into { dial, localDigits }
function splitPhone(stored) {
  if (!stored) return { dial: "", localDigits: "" };
  const dial = Object.keys(PHONE_RULES)
    .sort((a, b) => b.length - a.length)
    .find((d) => stored.startsWith(d));
  if (!dial) return { dial: "", localDigits: stored.replace(/\D/g, "") };
  return { dial, localDigits: stored.slice(dial.length) };
}

const PROFILE_ICONS = ["🧙", "⚔️", "🛡️", "🏹", "🐉", "🦄", "👑", "🎭", "🔮", "💎"];

const BUYER_MODE_KEY = "tavern_buyer_mode";

function readBuyerMode() {
  try {
    return sessionStorage.getItem(BUYER_MODE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeBuyerMode(enabled) {
  try {
    if (enabled) sessionStorage.setItem(BUYER_MODE_KEY, "1");
    else sessionStorage.removeItem(BUYER_MODE_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event("tavern:buyerModeChanged"));
}

export default function ProfilePage() {
  const user = getCurrentUser();
  const { isConnected, emitAccountUpdate, emitCountryList } = useSocket(null);

  const [countries, setCountries] = useState([]);
  const [phoneCountry, setPhoneCountry] = useState(null);
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  const initial = useMemo(() => {
    const { dial, localDigits } = splitPhone(user?.phone || "");
    return {
      name: user?.name || "",
      email: user?.email || "",
      phone: localDigits,
      dial,
      profileIcon: user?.profile_icon || "🧙",
    };
  }, [user]);

  const [formData, setFormData] = useState({
    name: initial.name,
    email: initial.email,
    phone: initial.phone,
    profileIcon: initial.profileIcon,
  });
  const [pwForm, setPwForm] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [showPwSection, setShowPwSection] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverMessage, setServerMessage] = useState({ type: "", text: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [buyerMode, setBuyerMode] = useState(() => readBuyerMode());
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleAvatarFile = async (file) => {
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      setServerMessage({ type: "error", text: "Please choose an image file." });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setServerMessage({ type: "error", text: "Image must be 2MB or smaller." });
      return;
    }
    setIsUploading(true);
    setServerMessage({ type: "", text: "" });
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch(`${API_BASE}/api/upload/avatar`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Upload failed");
      }
      setFormData((prev) => ({ ...prev, profileIcon: data.imageUrl }));
      setServerMessage({
        type: "success",
        text: "Image uploaded. Click Save Changes to apply.",
      });
    } catch (err) {
      setServerMessage({
        type: "error",
        text: err?.message || "Upload failed.",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const isVendor = (user?.role || "").toUpperCase() === "VENDOR";

  const toggleBuyerMode = () => {
    setBuyerMode((prev) => {
      const next = !prev;
      writeBuyerMode(next);
      return next;
    });
  };

  // Fetch countries list once connected
  useEffect(() => {
    if (!isConnected) return;
    let cancelled = false;
    emitCountryList().then((res) => {
      if (cancelled) return;
      const rows = res?.data;
      if (!Array.isArray(rows) || rows.length === 0) return;
      const mapped = rows.map((r) => ({
        flag: getFlagEmoji(r.code),
        name: r.name,
        dial: r.dial,
      }));
      setCountries(mapped);
      // Pre-select country from existing phone, fallback to first
      const fromUser = mapped.find((c) => c.dial === initial.dial);
      setPhoneCountry((prev) => prev ?? fromUser ?? mapped[0]);
    });
    return () => { cancelled = true; };
  }, [isConnected, emitCountryList, initial.dial]);

  const phoneRule = getPhoneRule(phoneCountry?.dial);

  const handleChange = (e) => {
    const { name, value } = e.target;
    let next = value;
    if (name === "phone") {
      next = value.replace(/\D/g, "").slice(0, phoneRule.max);
    }
    setFormData((prev) => ({ ...prev, [name]: next }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
    setServerMessage({ type: "", text: "" });
  };

  const validate = () => {
    const next = {};
    if (!formData.name.trim()) next.name = "Name is required";
    else if (formData.name.trim().length < 3) next.name = "Name must be at least 3 characters";

    if (!formData.email.trim()) next.email = "Email is required";
    else if (!emailRegex.test(formData.email.trim())) next.email = "Enter a valid email";

    if (formData.phone) {
      const len = formData.phone.length;
      if (len < phoneRule.min || len > phoneRule.max) {
        next.phone =
          phoneRule.min === phoneRule.max
            ? `Phone must be exactly ${phoneRule.min} digits`
            : `Phone must be ${phoneRule.min}–${phoneRule.max} digits`;
      } else if (/^0+$/.test(formData.phone)) {
        next.phone = "Phone cannot be all zeros";
      }
    }

    if (showPwSection) {
      if (!pwForm.current) next.current = "Current password is required";
      if (!pwForm.next) next.next = "New password is required";
      else if (!passwordRegex.test(pwForm.next))
        next.next = "Password must meet all requirements";
      if (pwForm.next !== pwForm.confirm) next.confirm = "Passwords do not match";
    }
    return next;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user?.id) {
      setServerMessage({ type: "error", text: "You must be logged in." });
      return;
    }
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setIsSubmitting(true);
    setServerMessage({ type: "", text: "" });

    const fullPhone = formData.phone
      ? (phoneCountry?.dial ?? "") + formData.phone
      : null;

    if (fullPhone && !phoneRegex.test(fullPhone)) {
      setErrors({ phone: "Enter a valid phone number" });
      setIsSubmitting(false);
      return;
    }

    try {
      const updatePayload = {
        id: user.id,
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: fullPhone,
        profileIcon: formData.profileIcon,
      };
      if (showPwSection && pwForm.current && pwForm.next) {
        updatePayload.currentPassword = pwForm.current;
        updatePayload.newPassword = pwForm.next;
      }

      const res = await emitAccountUpdate(updatePayload);

      if (!res?.success) {
        setServerMessage({
          type: "error",
          text: res?.message || "Failed to update profile.",
        });
        return;
      }

      const updated = res.data;
      setCurrentUser(updated);
      setUsername(updated?.name || formData.name.trim());
      window.dispatchEvent(new Event("tavern:authChanged"));
      setPwForm({ current: "", next: "", confirm: "" });
      setShowPwSection(false);
      setServerMessage({ type: "success", text: "Profile updated successfully." });
    } catch (err) {
      setServerMessage({
        type: "error",
        text: err?.message || "Failed to update profile.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = (hasError) =>
    `w-full rounded-xl border ${
      hasError ? "border-red-500/70" : "border-amber-900/30"
    } bg-slate-900/80 px-4 py-3 font-serif text-sm text-amber-100 placeholder-amber-100/30 transition focus:border-amber-600/50 focus:outline-none focus:ring-1 ${
      hasError ? "focus:ring-red-500/50" : "focus:ring-amber-600/30"
    }`;

  if (!user?.id) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-amber-900/30 bg-slate-950/60 p-8 text-center">
        <p className="font-serif text-amber-100/70">Please log in to view your profile.</p>
      </div>
    );
  }

  const avatarValue = formData.profileIcon || "🧙";
  const avatarIsImage = isImageUrl(avatarValue);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-900/30 bg-gradient-to-br from-slate-950 via-purple-950/40 to-slate-950 px-8 py-8 text-center shadow-2xl shadow-purple-900/20">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
        <h1 className="font-serif text-3xl font-bold tracking-wide text-amber-100">
          Welcome,{" "}
          <span className="font-semibold text-amber-200">
            {formData.name?.trim() || user.name || "Traveler"}
          </span>
        </h1>
        <p className="mt-2 font-serif text-base text-amber-300">
          To Your Profile          
        </p>
        <p className="mt-1 font-serif text-sm italic text-amber-100/60">
          Customize your tavern persona
        </p>
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
      </div>

      {serverMessage.text && (
        <div
          className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
            serverMessage.type === "success"
              ? "border-emerald-500/30 bg-emerald-950/30 text-emerald-200"
              : "border-red-500/30 bg-red-950/30 text-red-200"
          }`}
        >
          <span className="mt-0.5 shrink-0">
            {serverMessage.type === "success" ? "✅" : "⚠️"}
          </span>
          <span>{serverMessage.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
        {/* ================= LEFT COLUMN ================= */}
        <div className="space-y-4">
          {/* Avatar card */}
          <div className="relative overflow-hidden rounded-2xl border border-amber-900/30 bg-gradient-to-br from-slate-950 to-purple-950/20 p-6 shadow-xl shadow-purple-900/20">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />

            <h3 className="mb-4 font-serif text-xs font-semibold uppercase tracking-widest text-amber-100/60">
              Profile Picture
            </h3>

            {/* Big preview */}
            <div className="flex flex-col items-center">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-amber-500/10 blur-xl" />
                <div className="relative flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-2 border-amber-500/40 bg-slate-900 shadow-lg shadow-amber-900/20">
                  {avatarIsImage ? (
                    <img
                      src={resolveAvatarSrc(avatarValue)}
                      alt="Profile"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-6xl drop-shadow-lg">{avatarValue}</span>
                  )}
                </div>
                {isUploading && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-slate-950/70">
                    <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-amber-100/30 border-t-amber-100" />
                  </div>
                )}
              </div>

              {/* Upload + Remove buttons */}
              <div className="mt-4 flex w-full gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleAvatarFile(e.target.files?.[0])}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex-1 rounded-xl border border-amber-600/40 bg-amber-950/30 px-3 py-2 font-serif text-xs font-semibold text-amber-100 transition hover:border-amber-500 hover:bg-amber-950/50 disabled:opacity-50"
                >
                  📷 Upload Image
                </button>
                {avatarIsImage && (
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({ ...prev, profileIcon: "🧙" }))
                    }
                    className="rounded-xl border border-red-500/40 bg-red-950/20 px-3 py-2 font-serif text-xs text-red-200 transition hover:border-red-400 hover:bg-red-950/40"
                  >
                    Remove
                  </button>
                )}
              </div>
              <p className="mt-2 font-serif text-[11px] text-amber-100/40">
                PNG, JPG, GIF, or WebP — up to 2MB
              </p>
            </div>

            {/* Emoji fallback picker */}
            <div className="mt-6">
              <p className="mb-2 font-serif text-[11px] uppercase tracking-widest text-amber-100/50">
                Or choose an emoji
              </p>
              <div className="grid grid-cols-5 gap-2">
                {PROFILE_ICONS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({ ...prev, profileIcon: icon }))
                    }
                    className={`flex h-10 items-center justify-center rounded-lg border text-xl transition ${
                      formData.profileIcon === icon
                        ? "border-amber-500/60 bg-amber-950/40 shadow"
                        : "border-amber-900/30 bg-slate-950/60 hover:border-amber-700/50"
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />
          </div>

          {/* Buyer Mode card (vendor only) */}
          {isVendor && (
            <div className="relative overflow-hidden rounded-2xl border border-amber-900/30 bg-gradient-to-br from-slate-950 to-purple-950/20 p-6 shadow-xl shadow-purple-900/20">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />
              <div className="flex items-start gap-4">
                <span className="text-3xl">🛒</span>
                <div className="flex-1">
                  <h3 className="font-serif text-base font-bold text-amber-100">
                    Shop as a Buyer
                  </h3>
                  <p className="mt-1 font-serif text-xs text-amber-100/60">
                    Enable this to browse and buy from other vendors while
                    keeping your vendor account.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={toggleBuyerMode}
                  role="switch"
                  aria-checked={buyerMode}
                  className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition ${
                    buyerMode
                      ? "border-amber-500/60 bg-amber-700/60"
                      : "border-amber-900/40 bg-slate-800/80"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-amber-100 shadow transition ${
                      buyerMode ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
              {buyerMode && (
                <p className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-3 py-2 font-serif text-xs text-emerald-200">
                  ✅ Buyer mode is active — you can shop from other vendors.
                </p>
              )}
              <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />
            </div>
          )}

          {!isVendor && (
            <div className="rounded-2xl border border-amber-900/30 bg-gradient-to-br from-slate-950 to-purple-950/20 p-6 shadow-xl shadow-purple-900/20">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🛒</span>
                <p className="font-serif text-xs text-amber-100/70">
                  You can already shop from any vendor in the tavern. Visit the{" "}
                  <span className="text-amber-300">Shop</span> page to start browsing.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ================= RIGHT COLUMN ================= */}
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-2xl border border-amber-900/30 bg-gradient-to-br from-slate-950 to-purple-950/20 p-6 shadow-xl shadow-purple-900/20">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />

            <h3 className="mb-4 font-serif text-xs font-semibold uppercase tracking-widest text-amber-100/60">
              Account Details
            </h3>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="mb-2 block font-serif text-xs font-semibold uppercase tracking-widest text-amber-100/60">
                  Display Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Your tavern name"
                  className={inputClass(errors.name)}
                />
                {errors.name && (
                  <p className="mt-1 font-serif text-xs text-red-400">{errors.name}</p>
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
                  readOnly
                  disabled
                  placeholder="you@tavern.com"
                  autoComplete="email"
                  className={inputClass(false) + " cursor-not-allowed opacity-60"}
                />
                <p className="mt-1 font-serif text-xs text-amber-100/40">
                  Email cannot be changed.
                </p>
              </div>

              {/* Role read-only */}
              <div>
                <label className="mb-2 block font-serif text-xs font-semibold uppercase tracking-widest text-amber-100/60">
                  Account Type
                </label>
                <input
                  type="text"
                  value={user.role || "USER"}
                  disabled
                  className={inputClass(false) + " cursor-not-allowed opacity-60"}
                />
              </div>

              {/* Phone */}
              <div>
                <label className="mb-2 block font-serif text-xs font-semibold uppercase tracking-widest text-amber-100/60">
                  Phone
                </label>
                <div className="flex gap-2">
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowCountryPicker((v) => !v)}
                      onBlur={() => setTimeout(() => setShowCountryPicker(false), 150)}
                      disabled={countries.length === 0}
                      className="flex h-full min-w-[6rem] items-center gap-1.5 rounded-xl border border-amber-900/30 bg-slate-900/80 px-3 py-3 font-serif text-sm text-amber-100 transition hover:border-amber-700/50 focus:outline-none focus:ring-1 focus:ring-amber-600/30 disabled:opacity-50"
                    >
                      {countries.length === 0 ? (
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
                              const newMax = getPhoneRule(c.dial).max;
                              setFormData((prev) => ({
                                ...prev,
                                phone: prev.phone.slice(0, newMax),
                              }));
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
                  <input
                    type="tel"
                    name="phone"
                    value={formatPhone(formData.phone, phoneRule.groups)}
                    onChange={handleChange}
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
                    {phoneCountry?.dial} —{" "}
                    {phoneRule.min === phoneRule.max
                      ? `${phoneRule.min} digits`
                      : `${phoneRule.min}–${phoneRule.max} digits`}
                  </p>
                )}
              </div>

              {/* Password change (collapsible) */}
              <div className="rounded-xl border border-amber-900/30 bg-slate-950/40 p-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowPwSection((v) => !v);
                    if (showPwSection) {
                      setPwForm({ current: "", next: "", confirm: "" });
                      setErrors((prev) => ({
                        ...prev,
                        current: "",
                        next: "",
                        confirm: "",
                      }));
                    }
                  }}
                  className="flex w-full items-center justify-between font-serif text-sm font-semibold text-amber-100 hover:text-amber-300"
                >
                  <span className="flex items-center gap-2">
                    <span>🔐</span> Change Password
                  </span>
                  <span className="text-xs text-amber-100/50">
                    {showPwSection ? "▲ hide" : "▼ show"}
                  </span>
                </button>

                {showPwSection && (
                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="mb-1 block font-serif text-[11px] font-semibold uppercase tracking-widest text-amber-100/60">
                        Current Password
                      </label>
                      <input
                        type="password"
                        name="current"
                        value={pwForm.current}
                        onChange={(e) => {
                          setPwForm((p) => ({ ...p, current: e.target.value }));
                          setErrors((prev) => ({ ...prev, current: "" }));
                        }}
                        autoComplete="current-password"
                        className={inputClass(errors.current)}
                      />
                      {errors.current && (
                        <p className="mt-1 font-serif text-xs text-red-400">{errors.current}</p>
                      )}
                    </div>

                    <div>
                      <label className="mb-1 block font-serif text-[11px] font-semibold uppercase tracking-widest text-amber-100/60">
                        New Password
                      </label>
                      <input
                        type="password"
                        name="next"
                        value={pwForm.next}
                        onChange={(e) => {
                          setPwForm((p) => ({ ...p, next: e.target.value }));
                          setErrors((prev) => ({ ...prev, next: "" }));
                        }}
                        autoComplete="new-password"
                        className={inputClass(errors.next)}
                      />
                      {errors.next && (
                        <p className="mt-1 font-serif text-xs text-red-400">{errors.next}</p>
                      )}

                      {pwForm.next.length > 0 && (
                        <ul className="mt-2 space-y-0.5 font-serif text-[11px]">
                          {[
                            { ok: pwForm.next.length >= 8, label: "At least 8 characters" },
                            { ok: /[A-Z]/.test(pwForm.next), label: "One uppercase letter" },
                            { ok: /[a-z]/.test(pwForm.next), label: "One lowercase letter" },
                            { ok: /\d/.test(pwForm.next), label: "One number" },
                            { ok: /[^A-Za-z0-9]/.test(pwForm.next), label: "One special character" },
                          ].map((rule) => (
                            <li
                              key={rule.label}
                              className={
                                rule.ok ? "text-emerald-400" : "text-amber-100/40"
                              }
                            >
                              {rule.ok ? "✓" : "○"} {rule.label}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div>
                      <label className="mb-1 block font-serif text-[11px] font-semibold uppercase tracking-widest text-amber-100/60">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        name="confirm"
                        value={pwForm.confirm}
                        onChange={(e) => {
                          setPwForm((p) => ({ ...p, confirm: e.target.value }));
                          setErrors((prev) => ({ ...prev, confirm: "" }));
                        }}
                        autoComplete="new-password"
                        className={inputClass(errors.confirm)}
                      />
                      {errors.confirm && (
                        <p className="mt-1 font-serif text-xs text-red-400">{errors.confirm}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting || isUploading}
                className={`relative w-full overflow-hidden rounded-xl border py-3.5 font-serif text-base font-bold text-amber-100 transition-all duration-200 ${
                  isSubmitting || isUploading
                    ? "cursor-not-allowed border-amber-900/20 bg-slate-950/50 opacity-50"
                    : "border-amber-600/50 bg-gradient-to-r from-amber-950/60 to-purple-950/60 shadow-lg shadow-amber-900/20 hover:border-amber-500/80 hover:shadow-amber-500/20"
                }`}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-100/30 border-t-amber-100" />
                    Saving…
                  </span>
                ) : (
                  <span>💾 Save Changes</span>
                )}
              </button>
            </div>

            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />
          </div>
        </div>
      </form>
    </div>
  );
}
