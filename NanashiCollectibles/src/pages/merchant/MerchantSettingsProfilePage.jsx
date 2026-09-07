import { useEffect, useState } from "react";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import Badge from "../../components/ui/Badge.jsx";
import { TextField } from "../../components/ui/Field.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import { SkeletonText } from "../../components/ui/Skeleton.jsx";
import { useMerchantAuth } from "../../features/merchant/MerchantAuthContext.js";
import { useApiResource } from "../../features/merchant/useApiResource.js";
import * as merchantApi from "../../features/merchant/merchantApi.js";
import { useToast } from "../../components/ui/ToastContext.js";

export default function MerchantSettingsProfilePage() {
  const { token, activeMerchant, role } = useMerchantAuth();
  const { push } = useToast();
  const canEdit = role === "MERCHANT_OWNER" || role === "MERCHANT_ADMIN";

  const { status, data, error, refresh } = useApiResource(
    () => merchantApi.getSettings(token, { merchantId: activeMerchant?.merchantId }),
    [token, activeMerchant?.merchantId]
  );

  const [form, setForm] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    const merchant = data?.data?.merchant;
    if (merchant) {
      setForm({
        displayName: merchant.display_name || "",
        contactPerson: merchant.contact_person || "",
        phone: merchant.phone || "",
        businessCategory: merchant.business_category || "",
      });
    }
  }, [data]);

  if (status === "error") return <EmptyState title="Couldn't load settings" description={error} />;
  if (status === "loading" || !form) return <SkeletonText lines={5} />;

  const { merchant, addresses } = data.data;

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await merchantApi.updateSettings(token, form, { merchantId: activeMerchant?.merchantId });
      push({ tone: "success", message: "Settings saved." });
      refresh();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card variant="data">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-amber-50">{merchant.business_name}</h2>
          <Badge tone={merchant.status === "ACTIVE" ? "signal" : merchant.status === "PENDING" ? "gold" : "danger"}>{merchant.status}</Badge>
        </div>
        <p className="mt-1 text-xs text-amber-50/45">{merchant.email}</p>
      </Card>

      <Card variant="form">
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField id="settings-display-name" label="Store display name" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} disabled={!canEdit} required />
            <TextField id="settings-contact" label="Contact person" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} disabled={!canEdit} required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField id="settings-phone" label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} disabled={!canEdit} required />
            <TextField id="settings-category" label="Business category" value={form.businessCategory} onChange={(e) => setForm({ ...form, businessCategory: e.target.value })} disabled={!canEdit} />
          </div>

          {formError ? (
            <p role="alert" className="text-sm text-danger-400">
              {formError}
            </p>
          ) : null}

          {canEdit ? (
            <Button type="submit" isLoading={submitting} className="self-start">
              Save changes
            </Button>
          ) : (
            <p className="text-xs text-amber-50/40">Only store admins and owners can edit these settings.</p>
          )}
        </form>
      </Card>

      <Card variant="data">
        <h2 className="font-display text-base font-semibold text-amber-50">Business address</h2>
        {addresses?.length ? (
          <ul className="mt-3 flex flex-col gap-2 text-sm text-amber-50/70">
            {addresses.map((a) => (
              <li key={a.id}>
                {a.address_line1}
                {a.district ? `, ${a.district}` : ""}
                {a.postcode ? `, ${a.postcode}` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-amber-50/50">No address on file.</p>
        )}
        <p className="mt-3 text-xs text-amber-50/35">
          Address editing isn't available yet — contact NanashiCollectibles support to update it.
        </p>
      </Card>
    </div>
  );
}
