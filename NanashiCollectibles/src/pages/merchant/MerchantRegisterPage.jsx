import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Section from "../../components/layout/Section.jsx";
import Card from "../../components/ui/Card.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import { TextField, SelectField } from "../../components/ui/Field.jsx";
import { useMerchantAuth } from "../../features/merchant/MerchantAuthContext.js";

// Fields match Backend/routes/api/merchant.routes.js POST /register exactly —
// businessName, displayName, contactPerson, email, phone, password, businessCategory,
// and an optional address object. confirmPassword is a client-only check; the
// backend never sees it.
const BUSINESS_CATEGORIES = [
  { value: "", label: "Select a category" },
  { value: "tcg", label: "Trading Card Games" },
  { value: "collectibles", label: "Collectibles" },
  { value: "gunpla", label: "Gunpla" },
  { value: "drone", label: "Drone Parts" },
  { value: "computer_parts", label: "Computer Parts" },
  { value: "general", label: "General" },
];

const INITIAL_FORM = {
  businessName: "",
  displayName: "",
  contactPerson: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
  businessCategory: "",
  addressLine1: "",
  district: "",
  postcode: "",
};

export default function MerchantRegisterPage() {
  const { register } = useMerchantAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function updateField(field) {
    return (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    const required = ["businessName", "displayName", "contactPerson", "email", "phone", "password"];
    if (required.some((field) => !form[field].trim())) {
      setError("Business name, store name, contact person, email, phone, and password are required.");
      return;
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await register({
        businessName: form.businessName,
        displayName: form.displayName,
        contactPerson: form.contactPerson,
        email: form.email,
        phone: form.phone,
        password: form.password,
        businessCategory: form.businessCategory || undefined,
        address: form.addressLine1 ? { addressLine1: form.addressLine1, district: form.district, postcode: form.postcode } : undefined,
      });
      navigate("/merchant/pending", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Section spacing="lg" className="pb-20 pt-14 sm:pt-20">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.3fr] lg:items-start">
        <div className="hidden flex-col gap-4 lg:flex">
          <Badge tone="signal">Merchant Portal</Badge>
          <p className="font-display text-3xl font-semibold text-amber-50">Sell on NanashiCollectibles</p>
          <p className="max-w-sm text-sm text-amber-50/60">
            Registration creates your store profile with pending status — an admin reviews and activates it
            before you can list products.
          </p>
        </div>

        <Card variant="form" className="mx-auto w-full max-w-xl">
          <h1 className="font-display text-xl font-semibold text-amber-50 sm:text-2xl">Register your store</h1>
          <p className="mt-1 text-sm text-amber-50/60">Tell us about your business.</p>

          <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField id="reg-business-name" label="Business name" value={form.businessName} onChange={updateField("businessName")} required />
              <TextField id="reg-display-name" label="Store display name" value={form.displayName} onChange={updateField("displayName")} required />
            </div>

            <TextField id="reg-contact-person" label="Contact person" value={form.contactPerson} onChange={updateField("contactPerson")} required />

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField id="reg-email" label="Email" type="email" value={form.email} onChange={updateField("email")} autoComplete="email" required />
              <TextField id="reg-phone" label="Phone" type="tel" hint="e.g. +6738000000" value={form.phone} onChange={updateField("phone")} autoComplete="tel" required />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField id="reg-password" label="Password" hint="At least 8 characters." type="password" value={form.password} onChange={updateField("password")} autoComplete="new-password" minLength={8} required />
              <TextField id="reg-confirm-password" label="Confirm password" type="password" value={form.confirmPassword} onChange={updateField("confirmPassword")} autoComplete="new-password" required />
            </div>

            <SelectField id="reg-category" label="Business category" hint="Optional" value={form.businessCategory} onChange={updateField("businessCategory")}>
              {BUSINESS_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </SelectField>

            <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
              <TextField id="reg-address" label="Address" hint="Optional" value={form.addressLine1} onChange={updateField("addressLine1")} />
              <TextField id="reg-district" label="District" hint="Optional" value={form.district} onChange={updateField("district")} />
              <TextField id="reg-postcode" label="Postcode" hint="Optional" value={form.postcode} onChange={updateField("postcode")} />
            </div>

            {error ? (
              <p role="alert" className="text-sm text-danger-400">
                {error}
              </p>
            ) : null}

            <Button type="submit" isLoading={submitting}>
              {submitting ? "Creating store…" : "Create store account"}
            </Button>

            <p className="text-sm text-amber-50/50">
              Already registered?{" "}
              <Link to="/merchant/login" className="rounded text-brand-400 hover:text-brand-300 focus-ring">
                Log in
              </Link>
            </p>
          </form>
        </Card>
      </div>
    </Section>
  );
}
