import { useState } from "react";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import { TextField, CheckboxField } from "../../components/ui/Field.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import { SkeletonText } from "../../components/ui/Skeleton.jsx";
import RoleGate from "../../components/merchant/RoleGate.jsx";
import { useMerchantAuth } from "../../features/merchant/MerchantAuthContext.js";
import { useApiResource } from "../../features/merchant/useApiResource.js";
import * as merchantApi from "../../features/merchant/merchantApi.js";
import { useToast } from "../../components/ui/ToastContext.js";

function isValidE164(phone) {
  return /^\+[1-9]\d{6,14}$/.test(phone.trim());
}

function OrderNotificationsSection() {
  const { token, activeMerchant } = useMerchantAuth();
  const { push } = useToast();
  const { status, data, error, refresh } = useApiResource(
    () => merchantApi.getNotificationSettings(token, { merchantId: activeMerchant?.merchantId }),
    [token, activeMerchant?.merchantId]
  );

  const [enabled, setEnabled] = useState(false);
  const [phone, setPhone] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState(null);

  if (status === "success" && !initialized) {
    setEnabled(Boolean(data.data.whatsappEnabled));
    setPhone(data.data.whatsappPhone || "");
    setInitialized(true);
  }

  if (status === "loading") return <SkeletonText lines={4} />;
  if (status === "error")
    return (
      <EmptyState
        title="Couldn't load notification settings"
        description={error}
        action={
          <Button variant="secondary" size="sm" onClick={refresh}>
            Try again
          </Button>
        }
      />
    );

  async function handleSave(event) {
    event.preventDefault();
    setFieldError(null);

    const trimmedPhone = phone.trim();
    if (enabled && !isValidE164(trimmedPhone)) {
      setFieldError("Enter a valid WhatsApp number in international format, e.g. +6738888888.");
      return;
    }
    if (trimmedPhone && !isValidE164(trimmedPhone)) {
      setFieldError("Phone number must be in international format, e.g. +6738888888.");
      return;
    }

    setSubmitting(true);
    try {
      await merchantApi.updateNotificationSettings(
        token,
        { whatsappEnabled: enabled, whatsappPhone: trimmedPhone },
        { merchantId: activeMerchant?.merchantId }
      );
      push({ tone: "success", message: "Notification settings saved." });
      refresh();
    } catch (err) {
      setFieldError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card variant="form">
      <h2 className="font-display text-base font-semibold text-amber-50">Order notifications</h2>
      <p className="mt-1 text-xs text-amber-50/45">
        Receive order notifications through WhatsApp whenever a new order is placed for your store. Off by default —
        you choose to turn this on.
      </p>

      <form onSubmit={handleSave} noValidate className="mt-4 flex flex-col gap-4">
        <CheckboxField
          id="whatsapp-enabled"
          label="Receive order notifications through WhatsApp"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        <TextField
          id="whatsapp-phone"
          label="WhatsApp number"
          hint="International format, e.g. +6738888888."
          placeholder="+673 XXXXXXX"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="off"
        />

        {fieldError ? (
          <p role="alert" className="text-sm text-danger-400">
            {fieldError}
          </p>
        ) : null}

        <Button type="submit" isLoading={submitting} className="self-start">
          Save
        </Button>
      </form>
    </Card>
  );
}

export default function MerchantSettingsNotificationsPage() {
  return (
    <RoleGate allow={["MERCHANT_OWNER", "MERCHANT_ADMIN"]}>
      <OrderNotificationsSection />
    </RoleGate>
  );
}
