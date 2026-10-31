import { useEffect, useState } from "react";
import Modal from "../ui/Modal.jsx";
import Button from "../ui/Button.jsx";
import { TextField } from "../ui/Field.jsx";
import { formatAddressInline } from "../../features/checkout/addressFormat.js";

const EMPTY_FORM = {
  label: "",
  recipientName: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  village: "",
  mukim: "",
  district: "",
  postcode: "",
};

// Contact card's "Change"/"+ Add address" surface. Two internal steps —
// "select" (radio list of the customer's existing CUSTOMER_ADDRESSES rows)
// and "add" (the new-address form) — rather than two separate modals, so
// switching between them doesn't lose focus/scroll state. A customer with
// zero saved addresses opens straight into "add" since there's nothing to
// select. Address creation itself (POST /api/addresses) is the caller's
// responsibility via `onCreate` — this component is presentation + local
// form state only, per the project's "pages orchestrate data" convention.
export default function AddressSelectorModal({ open, onClose, addresses, selectedAddressId, onSelect, onCreate }) {
  const hasAddresses = addresses.length > 0;
  const [step, setStep] = useState(hasAddresses ? "select" : "add");
  const [pendingId, setPendingId] = useState(selectedAddressId);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setStep(hasAddresses ? "select" : "add");
    setPendingId(selectedAddressId);
    setForm(EMPTY_FORM);
    setErrors({});
    setSubmitError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function updateField(field) {
    return (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));
  }

  function handleUseSelected() {
    if (pendingId == null) return;
    onSelect(pendingId);
  }

  async function handleSaveNew() {
    const nextErrors = {};
    if (!form.addressLine1.trim()) nextErrors.addressLine1 = "Required";
    if (!form.recipientName.trim()) nextErrors.recipientName = "Required";
    if (!form.phone.trim()) nextErrors.phone = "Required";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitError(null);
    setSubmitting(true);
    try {
      await onCreate(form);
    } catch (err) {
      setSubmitError(err.message || "Couldn't save that address. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={step === "select" ? "Select an address" : hasAddresses ? "Add a new address" : "Add address"}
      footer={
        step === "select" ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleUseSelected} disabled={pendingId == null}>
              Use this address
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSaveNew} isLoading={submitting}>
              Save &amp; use this address
            </Button>
          </>
        )
      }
    >
      {step === "select" ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2.5">
            {addresses.map((address) => (
              <label
                key={address.id}
                className={[
                  "flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-colors duration-150",
                  pendingId === address.id ? "border-brand-400 bg-brand-500/5" : "border-white/10 hover:border-white/20",
                ].join(" ")}
              >
                <input
                  type="radio"
                  name="address-selector"
                  className="mt-1 h-4 w-4 shrink-0 border-white/20 bg-ink-900 accent-brand-500 focus-ring"
                  checked={pendingId === address.id}
                  onChange={() => setPendingId(address.id)}
                />
                <span className="min-w-0 text-sm">
                  <span className="flex items-center gap-2 text-amber-50/90">
                    <span className="font-medium">{address.label || "Address"}</span>
                    {address.isDefaultShipping ? (
                      <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-amber-50/40">Default</span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-amber-50/70">{address.recipientName}</span>
                  <span className="block text-amber-50/50">{formatAddressInline(address)}</span>
                </span>
              </label>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setStep("add")}
            className="self-start rounded text-sm font-medium text-brand-400 transition-colors duration-150 hover:text-brand-300 focus-ring"
          >
            + Add new address
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {hasAddresses ? (
            <button
              type="button"
              onClick={() => setStep("select")}
              className="self-start rounded text-sm text-amber-50/60 transition-colors duration-150 hover:text-amber-50/85 focus-ring"
            >
              ← Use a saved address
            </button>
          ) : (
            <p className="text-sm text-amber-50/60">Add an address to continue with delivery.</p>
          )}

          <TextField id="new-address-label" label="Label" hint="Optional — e.g. Home, Office" value={form.label} onChange={updateField("label")} />
          <TextField id="new-address-recipient" label="Recipient name" value={form.recipientName} onChange={updateField("recipientName")} error={errors.recipientName} required />
          <TextField id="new-address-phone" label="Phone" type="tel" value={form.phone} onChange={updateField("phone")} error={errors.phone} required />
          <TextField id="new-address-line1" label="Address line 1" value={form.addressLine1} onChange={updateField("addressLine1")} error={errors.addressLine1} required />
          <TextField id="new-address-line2" label="Address line 2" hint="Optional" value={form.addressLine2} onChange={updateField("addressLine2")} />
          <div className="grid grid-cols-2 gap-4">
            <TextField id="new-address-village" label="Village" value={form.village} onChange={updateField("village")} />
            <TextField id="new-address-mukim" label="Mukim" value={form.mukim} onChange={updateField("mukim")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <TextField id="new-address-district" label="District" value={form.district} onChange={updateField("district")} />
            <TextField id="new-address-postcode" label="Postcode" value={form.postcode} onChange={updateField("postcode")} />
          </div>

          {submitError ? (
            <p role="alert" className="text-sm text-danger-400">
              {submitError}
            </p>
          ) : null}
        </div>
      )}
    </Modal>
  );
}
