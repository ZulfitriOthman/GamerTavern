import { useState } from "react";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import { TextField } from "../../components/ui/Field.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import { SkeletonText } from "../../components/ui/Skeleton.jsx";
import RoleGate from "../../components/merchant/RoleGate.jsx";
import { useMerchantAuth } from "../../features/merchant/MerchantAuthContext.js";
import { useApiResource } from "../../features/merchant/useApiResource.js";
import * as merchantApi from "../../features/merchant/merchantApi.js";
import { useToast } from "../../components/ui/ToastContext.js";

const INITIAL_FORM = { bankName: "", accountName: "", accountNumber: "" };

function BankDetailsForm({ onSaved }) {
  const { token, activeMerchant } = useMerchantAuth();
  const { push } = useToast();
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    if (!form.bankName.trim() || !form.accountName.trim() || !form.accountNumber.trim()) {
      setError("Bank name, account holder, and account number are required.");
      return;
    }

    setSubmitting(true);
    try {
      await merchantApi.saveBankDetails(token, form, { merchantId: activeMerchant?.merchantId });
      push({ tone: "success", message: "Bank details saved." });
      setForm(INITIAL_FORM);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card variant="form">
      <h2 className="font-display text-base font-semibold text-amber-50">Add payout account</h2>
      <p className="mt-1 text-xs text-amber-50/45">
        Sent to the server over HTTPS and encrypted at rest — never stored in this browser, and never shown back to
        you in full once saved.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-4 flex flex-col gap-4">
        <TextField id="bank-name" label="Bank name" value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} autoComplete="off" required />
        <TextField id="bank-account-name" label="Account holder name" value={form.accountName} onChange={(e) => setForm({ ...form, accountName: e.target.value })} autoComplete="off" required />
        <TextField id="bank-account-number" label="Account number" value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} autoComplete="off" required />

        {error ? (
          <p role="alert" className="text-sm text-danger-400">
            {error}
          </p>
        ) : null}

        <Button type="submit" isLoading={submitting} className="self-start">
          Save bank details
        </Button>
      </form>
    </Card>
  );
}

function BankSettings() {
  const { token, activeMerchant } = useMerchantAuth();
  const { status, data, error, refresh } = useApiResource(
    () => merchantApi.getSettings(token, { merchantId: activeMerchant?.merchantId }),
    [token, activeMerchant?.merchantId]
  );

  if (status === "loading") return <SkeletonText lines={4} />;
  if (status === "error") return <EmptyState title="Couldn't load bank details" description={error} />;

  const bankDetails = data.data.bankDetails || [];

  return (
    <div className="flex flex-col gap-6">
      <Card variant="data">
        <h2 className="font-display text-base font-semibold text-amber-50">On file</h2>
        {bankDetails.length ? (
          <ul className="mt-3 flex flex-col gap-2">
            {bankDetails.map((b) => (
              <li key={b.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-ink-900/50 px-4 py-3 text-sm">
                <div>
                  <p className="text-amber-50/85">{b.bank_name}</p>
                  <p className="text-xs text-amber-50/45">{b.account_name}</p>
                </div>
                <span className="font-mono text-amber-50/70">{b.accountNumberMasked}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState className="mt-3" title="No payout account on file" description="Add one below so NanashiCollectibles can send payouts." />
        )}
      </Card>

      <BankDetailsForm onSaved={refresh} />
    </div>
  );
}

export default function MerchantSettingsBankPage() {
  return (
    <RoleGate allow={["MERCHANT_OWNER"]}>
      <BankSettings />
    </RoleGate>
  );
}
