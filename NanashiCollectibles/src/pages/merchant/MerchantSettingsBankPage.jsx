import { useState } from "react";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import Modal from "../../components/ui/Modal.jsx";
import StatusBadge from "../../components/ui/StatusBadge.jsx";
import Badge from "../../components/ui/Badge.jsx";
import { TextField, TextareaField, SelectField, CheckboxField } from "../../components/ui/Field.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import { SkeletonText } from "../../components/ui/Skeleton.jsx";
import RoleGate from "../../components/merchant/RoleGate.jsx";
import { useMerchantAuth } from "../../features/merchant/MerchantAuthContext.js";
import { useApiResource } from "../../features/merchant/useApiResource.js";
import * as merchantApi from "../../features/merchant/merchantApi.js";
import { useToast } from "../../components/ui/ToastContext.js";

// Mirrors Backend/modules/merchantPayments.module.js SUPPORTED_BANKS.
const BANKS = [
  { value: "BIBD", label: "BIBD" },
  { value: "BAIDURI", label: "Baiduri" },
  { value: "TAIB", label: "TAIB" },
  { value: "OTHER", label: "Other" },
];

const EMPTY_BANK_FORM = {
  bankName: "BIBD",
  bankOtherLabel: "",
  displayName: "",
  accountName: "",
  accountNumber: "",
  swiftCode: "",
  notes: "",
  isDefault: false,
};

// Shared by both "add" and "edit" — in edit mode, `account` is the existing
// (masked) row and the account-number field defaults to the "keep existing"
// state so the current value is never decrypted just to populate a form.
function BankAccountForm({ account, onSubmit, onCancel, submitting, error }) {
  const isEdit = Boolean(account);
  const [form, setForm] = useState(() =>
    isEdit
      ? {
          bankName: account.bank,
          bankOtherLabel: account.bankOtherLabel || "",
          displayName: account.displayName || "",
          accountName: account.accountName || "",
          accountNumber: "",
          swiftCode: account.swiftCode || "",
          notes: account.notes || "",
          isDefault: account.isDefault,
        }
      : EMPTY_BANK_FORM
  );
  const [replacingAccountNumber, setReplacingAccountNumber] = useState(!isEdit);

  function update(field) {
    return (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    const payload = {
      bankName: form.bankName,
      bankOtherLabel: form.bankName === "OTHER" ? form.bankOtherLabel : undefined,
      displayName: form.displayName,
      accountName: form.accountName,
      swiftCode: form.swiftCode,
      notes: form.notes,
      isDefault: form.isDefault,
    };
    if (!isEdit || replacingAccountNumber) {
      payload.accountNumber = form.accountNumber;
    }
    onSubmit(payload);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <p className="rounded-lg border border-white/10 bg-ink-900/50 px-3.5 py-2.5 text-xs text-amber-50/55">
        Enter your bank account details. Do not enter debit/credit card information — card numbers, CVV, PIN, and
        expiry are never requested here.
      </p>

      <SelectField id="bank-name" label="Bank" value={form.bankName} onChange={update("bankName")} required>
        {BANKS.map((b) => (
          <option key={b.value} value={b.value}>
            {b.label}
          </option>
        ))}
      </SelectField>

      {form.bankName === "OTHER" ? (
        <TextField
          id="bank-other-label"
          label="Bank name"
          hint="Only used when Bank is set to Other."
          value={form.bankOtherLabel}
          onChange={update("bankOtherLabel")}
          required
        />
      ) : null}

      <TextField
        id="bank-display-name"
        label="Account display name"
        hint="Shown to customers — e.g. your storefront name."
        value={form.displayName}
        onChange={update("displayName")}
        placeholder="Nanashi Collectibles"
      />

      <TextField
        id="bank-account-name"
        label="Account holder name"
        hint="The legal name on the bank account."
        value={form.accountName}
        onChange={update("accountName")}
        required
      />

      {isEdit && !replacingAccountNumber ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-amber-50/70">Account number</span>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-ink-900 px-3.5 py-2.5">
            <span className="font-mono text-sm text-amber-50/70">{account.accountNumberMasked || "••••••••"}</span>
            <Button type="button" variant="link" size="sm" onClick={() => setReplacingAccountNumber(true)}>
              Replace account number
            </Button>
          </div>
        </div>
      ) : (
        <TextField
          id="bank-account-number"
          label="Account number"
          value={form.accountNumber}
          onChange={update("accountNumber")}
          autoComplete="off"
          required
          labelExtra={
            isEdit ? (
              <Button type="button" variant="link" size="sm" onClick={() => setReplacingAccountNumber(false)}>
                Keep existing account number
              </Button>
            ) : null
          }
        />
      )}

      <TextField id="bank-swift" label="SWIFT code" hint="Optional." value={form.swiftCode} onChange={update("swiftCode")} autoComplete="off" />
      <TextareaField id="bank-notes" label="Notes" hint="Optional." rows={2} value={form.notes} onChange={update("notes")} />

      <CheckboxField
        id="bank-is-default"
        label="Make this the default account"
        checked={form.isDefault}
        onChange={(e) => setForm((prev) => ({ ...prev, isDefault: e.target.checked }))}
      />

      {error ? (
        <p role="alert" className="text-sm text-danger-400">
          {error}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Button type="submit" isLoading={submitting}>
          {isEdit ? "Save changes" : "Save bank account"}
        </Button>
        {onCancel ? (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}

// Grouped ONLINE / MANUAL-OFFLINE per the Merchant Payments UX pass — keeps
// the screen legible as more methods are added, rather than one flat list.
// Fulfilment-gated methods (Pay on Delivery / Pay on Pickup) live here too
// even though eligibility at checkout also depends on FulfilmentMethodsSection
// below — this section only controls whether the merchant accepts the
// *payment* method at all; whether it ever gets offered to a given customer
// additionally depends on which fulfilment method that customer chose.
function PaymentMethodsSection({ paymentMethods, onSaved }) {
  const { token, activeMerchant } = useMerchantAuth();
  const { push } = useToast();
  const [savingMethod, setSavingMethod] = useState(null);

  const enabledByMethod = new Map(paymentMethods.map((m) => [m.method, m.enabled]));

  async function toggle(method, field, enabled) {
    setSavingMethod(method);
    try {
      await merchantApi.updatePaymentMethods(token, { [field]: enabled }, { merchantId: activeMerchant?.merchantId });
      onSaved();
    } catch (err) {
      push({ tone: "error", message: err.message });
    } finally {
      setSavingMethod(null);
    }
  }

  return (
    <Card variant="form">
      <h2 className="font-display text-base font-semibold text-amber-50">Payment methods</h2>
      <p className="mt-1 text-xs text-amber-50/45">Choose how customers can pay you at checkout.</p>

      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-amber-50/40">Online</p>
      <div className="mt-2 flex flex-col gap-3">
        <CheckboxField
          id="method-online-payment"
          label="Online Payment"
          hint="Setup only for now — enabling this does not yet route payments to your account. See Online Payment below."
          checked={enabledByMethod.get("ONLINE_PAYMENT") || false}
          disabled={savingMethod === "ONLINE_PAYMENT"}
          onChange={(e) => toggle("ONLINE_PAYMENT", "onlinePaymentEnabled", e.target.checked)}
        />
      </div>

      <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-amber-50/40">Manual / Offline</p>
      <div className="mt-2 flex flex-col gap-3">
        <CheckboxField
          id="method-bank-transfer"
          label="Bank Transfer"
          hint="Customers see your bank details and transfer manually; you confirm the payment yourself."
          checked={enabledByMethod.get("BANK_TRANSFER") || false}
          disabled={savingMethod === "BANK_TRANSFER"}
          onChange={(e) => toggle("BANK_TRANSFER", "bankTransferEnabled", e.target.checked)}
        />
        <CheckboxField
          id="method-pay-on-delivery"
          label="Pay on Delivery"
          hint="Customer pays you when the order is delivered — only offered at checkout if you also accept Delivery below."
          checked={enabledByMethod.get("PAY_ON_DELIVERY") || false}
          disabled={savingMethod === "PAY_ON_DELIVERY"}
          onChange={(e) => toggle("PAY_ON_DELIVERY", "payOnDeliveryEnabled", e.target.checked)}
        />
        <CheckboxField
          id="method-pay-on-pickup"
          label="Pay on Pickup"
          hint="Customer pays you when collecting the order — only offered at checkout if you also accept Pickup below."
          checked={enabledByMethod.get("PAY_ON_PICKUP") || false}
          disabled={savingMethod === "PAY_ON_PICKUP"}
          onChange={(e) => toggle("PAY_ON_PICKUP", "payOnPickupEnabled", e.target.checked)}
        />
      </div>
    </Card>
  );
}

// A payment method (how the customer pays) is a distinct concept from a
// fulfilment method (how the order reaches them) — "Delivery" itself is
// never a payment method. This section controls fulfilment only; whether
// Pay on Delivery / Pay on Pickup show up at checkout depends on both this
// AND the matching toggle in PaymentMethodsSection above.
function FulfilmentMethodsSection({ fulfilmentMethods, onSaved }) {
  const { token, activeMerchant } = useMerchantAuth();
  const { push } = useToast();
  const [savingMethod, setSavingMethod] = useState(null);

  const enabledByMethod = new Map(fulfilmentMethods.map((m) => [m.method, m.enabled]));

  async function toggle(method, field, enabled) {
    setSavingMethod(method);
    try {
      await merchantApi.updateFulfilmentMethods(token, { [field]: enabled }, { merchantId: activeMerchant?.merchantId });
      onSaved();
    } catch (err) {
      push({ tone: "error", message: err.message });
    } finally {
      setSavingMethod(null);
    }
  }

  return (
    <Card variant="form">
      <h2 className="font-display text-base font-semibold text-amber-50">Fulfilment methods</h2>
      <p className="mt-1 text-xs text-amber-50/45">
        Choose how customers can receive orders from you. Nanashi is multi-merchant — this is set per merchant, not assumed.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        <CheckboxField
          id="fulfilment-delivery"
          label="Delivery"
          hint="You deliver orders to the customer."
          checked={enabledByMethod.get("DELIVERY") || false}
          disabled={savingMethod === "DELIVERY"}
          onChange={(e) => toggle("DELIVERY", "deliveryEnabled", e.target.checked)}
        />
        <CheckboxField
          id="fulfilment-pickup"
          label="Pickup"
          hint="Customers collect orders directly from you."
          checked={enabledByMethod.get("PICKUP") || false}
          disabled={savingMethod === "PICKUP"}
          onChange={(e) => toggle("PICKUP", "pickupEnabled", e.target.checked)}
        />
      </div>
    </Card>
  );
}

function OnlinePaymentSection({ paymentAccounts, onSaved }) {
  const { token, activeMerchant } = useMerchantAuth();
  const { push } = useToast();
  const [configuring, setConfiguring] = useState(false);
  const [form, setForm] = useState({ provider: "", providerMerchantId: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const account = paymentAccounts[0] || null;

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    if (!form.provider.trim()) {
      setError("Provider is required.");
      return;
    }
    setSubmitting(true);
    try {
      await merchantApi.savePaymentAccount(token, form, { merchantId: activeMerchant?.merchantId });
      push({ tone: "success", message: "Online payment configuration saved." });
      setConfiguring(false);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card variant="form">
      <h2 className="font-display text-base font-semibold text-amber-50">Online payment</h2>
      <p className="mt-1 text-xs text-amber-50/45">
        Configuration only for now. Saving a provider here does not mean online payments actually settle to your
        account yet — real per-merchant online-payment routing is a future capability, not a live payment method.
      </p>

      <div className="mt-4 flex items-center justify-between rounded-lg border border-white/10 bg-ink-900/50 px-4 py-3 text-sm">
        <div>
          <p className="text-amber-50/85">{account?.provider || "No provider configured"}</p>
          <p className="text-xs text-amber-50/45">
            {account?.provider_merchant_id ? `Account ID: ${account.provider_merchant_id}` : "Merchant gateway connection: Not connected"}
          </p>
        </div>
        <StatusBadge status={account?.status || "NOT_CONFIGURED"} />
      </div>

      {configuring ? (
        <form onSubmit={handleSubmit} noValidate className="mt-4 flex flex-col gap-4">
          <TextField
            id="payment-provider"
            label="Provider"
            hint="A short identifier for the gateway, e.g. BAIDURI_GATEWAY."
            value={form.provider}
            onChange={(e) => setForm((prev) => ({ ...prev, provider: e.target.value.toUpperCase() }))}
            required
          />
          <TextField
            id="payment-provider-merchant-id"
            label="Provider merchant/account ID"
            hint="Optional — your account or merchant ID with that provider."
            value={form.providerMerchantId}
            onChange={(e) => setForm((prev) => ({ ...prev, providerMerchantId: e.target.value }))}
          />
          {error ? (
            <p role="alert" className="text-sm text-danger-400">
              {error}
            </p>
          ) : null}
          <div className="flex gap-3">
            <Button type="submit" isLoading={submitting}>
              Save configuration
            </Button>
            <Button type="button" variant="secondary" onClick={() => setConfiguring(false)} disabled={submitting}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="secondary" size="sm" className="mt-4" onClick={() => setConfiguring(true)}>
          Configure Online Payment
        </Button>
      )}
    </Card>
  );
}

function BankAccountsSection({ bankDetails, onChanged }) {
  const { token, activeMerchant } = useMerchantAuth();
  const { push } = useToast();
  const [modalMode, setModalMode] = useState(null); // null | "add" | { edit: account }
  const [confirmDelete, setConfirmDelete] = useState(null); // account | null
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);

  async function handleCreate(payload) {
    setSubmitting(true);
    setError(null);
    try {
      await merchantApi.saveBankDetails(token, payload, { merchantId: activeMerchant?.merchantId });
      push({ tone: "success", message: "Bank account added." });
      setModalMode(null);
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate(id, payload) {
    setSubmitting(true);
    setError(null);
    try {
      await merchantApi.updateBankDetails(token, id, payload, { merchantId: activeMerchant?.merchantId });
      push({ tone: "success", message: "Bank account updated." });
      setModalMode(null);
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await merchantApi.deleteBankDetails(token, confirmDelete.id, { merchantId: activeMerchant?.merchantId });
      push({ tone: "success", message: "Bank account removed." });
      setConfirmDelete(null);
      onChanged();
    } catch (err) {
      push({ tone: "error", message: err.message });
    } finally {
      setDeleting(false);
    }
  }

  async function handleSetDefault(account) {
    try {
      await merchantApi.setDefaultBankDetails(token, account.id, { merchantId: activeMerchant?.merchantId });
      onChanged();
    } catch (err) {
      push({ tone: "error", message: err.message });
    }
  }

  return (
    <>
      <Card variant="data">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-amber-50">Bank accounts</h2>
          <Button size="sm" onClick={() => setModalMode("add")}>
            + Add Bank Account
          </Button>
        </div>

        {bankDetails.length ? (
          <ul className="mt-3 flex flex-col gap-2">
            {bankDetails.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-ink-900/50 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-amber-50/85">{b.bank === "OTHER" ? b.bankOtherLabel || "Other" : b.bank}</p>
                    {b.isDefault ? <Badge tone="signal">Default</Badge> : null}
                  </div>
                  <p className="text-xs text-amber-50/45">{b.displayName}</p>
                  <p className="font-mono text-xs text-amber-50/60">{b.accountNumberMasked}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {!b.isDefault ? (
                    <Button variant="link" size="sm" onClick={() => handleSetDefault(b)}>
                      Set default
                    </Button>
                  ) : null}
                  <Button variant="secondary" size="sm" onClick={() => setModalMode({ edit: b })}>
                    Edit
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => setConfirmDelete(b)}>
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState className="mt-3" title="No bank account on file" description="Add one so customers can pay you by bank transfer." />
        )}
      </Card>

      <Modal open={modalMode === "add"} onClose={() => setModalMode(null)} title="Add bank account">
        <BankAccountForm onSubmit={handleCreate} onCancel={() => setModalMode(null)} submitting={submitting} error={error} />
      </Modal>

      <Modal open={Boolean(modalMode && modalMode.edit)} onClose={() => setModalMode(null)} title="Edit bank account">
        {modalMode?.edit ? (
          <BankAccountForm
            account={modalMode.edit}
            onSubmit={(payload) => handleUpdate(modalMode.edit.id, payload)}
            onCancel={() => setModalMode(null)}
            submitting={submitting}
            error={error}
          />
        ) : null}
      </Modal>

      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="Remove bank account"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} isLoading={deleting}>
              Remove
            </Button>
          </>
        }
      >
        <p className="text-sm text-amber-50/70">
          Remove {confirmDelete?.displayName || confirmDelete?.bank}? This cannot be undone.
        </p>
      </Modal>
    </>
  );
}

function PaymentsSettings() {
  const { token, activeMerchant } = useMerchantAuth();
  const { status, data, error, refresh } = useApiResource(
    () => merchantApi.getSettings(token, { merchantId: activeMerchant?.merchantId }),
    [token, activeMerchant?.merchantId]
  );

  if (status === "loading") return <SkeletonText lines={4} />;
  if (status === "error")
    return (
      <EmptyState
        title="Couldn't load payment settings"
        description={error}
        action={
          <Button variant="secondary" size="sm" onClick={refresh}>
            Try again
          </Button>
        }
      />
    );

  const bankDetails = data.data.bankDetails || [];
  const paymentMethods = data.data.paymentMethods || [];
  const paymentAccounts = data.data.paymentAccounts || [];
  const fulfilmentMethods = data.data.fulfilmentMethods || [];

  return (
    <div className="flex flex-col gap-6">
      <PaymentMethodsSection paymentMethods={paymentMethods} onSaved={refresh} />
      <FulfilmentMethodsSection fulfilmentMethods={fulfilmentMethods} onSaved={refresh} />
      <BankAccountsSection bankDetails={bankDetails} onChanged={refresh} />
      <OnlinePaymentSection paymentAccounts={paymentAccounts} onSaved={refresh} />
    </div>
  );
}

export default function MerchantSettingsBankPage() {
  return (
    <RoleGate allow={["MERCHANT_OWNER"]}>
      <PaymentsSettings />
    </RoleGate>
  );
}
