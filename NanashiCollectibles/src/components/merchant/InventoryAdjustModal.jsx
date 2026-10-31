import { useEffect, useState } from "react";
import Modal from "../ui/Modal.jsx";
import Button from "../ui/Button.jsx";
import Icon from "../ui/Icon.jsx";
import { TextField, SelectField } from "../ui/Field.jsx";
import { useSocket } from "../../services/socket/SocketContext.js";
import { adjustInventory } from "../../features/merchant/merchantProductSocketService.js";

// Backend/controllers/product.controller.js's inventory:adjust takes an
// explicit direction ("stock_in"|"stock_out") plus a POSITIVE quantity —
// the backend is the single source of truth for turning that into the
// signed delta actually applied (never a client-computed signed delta).
// inventory_movements.reason is VARCHAR(100) with no separate notes
// column, so a short note gets folded into that string rather than
// dropped. STOCK_IN/RETURN reuse the codes this modal already wrote
// historically; CORRECTION/OTHER are shared between both directions.
const REASONS_BY_TYPE = {
  stock_in: [
    { value: "STOCK_IN", label: "Restock" },
    { value: "RETURN", label: "Returned item" },
    { value: "INITIAL", label: "Initial inventory" },
    { value: "CORRECTION", label: "Stock correction" },
    { value: "OTHER", label: "Other" },
  ],
  stock_out: [
    { value: "DAMAGED", label: "Damaged" },
    { value: "LOST", label: "Lost" },
    { value: "MANUAL_SALE", label: "Manual sale" },
    { value: "INTERNAL_USE", label: "Internal use" },
    { value: "CORRECTION", label: "Stock correction" },
    { value: "OTHER", label: "Other" },
  ],
};

const TYPE_OPTIONS = [
  { value: "stock_in", label: "Stock In", icon: "plus", tone: "text-signal-300 border-signal-500/40 bg-signal-500/10" },
  { value: "stock_out", label: "Stock Out", icon: "minus", tone: "text-danger-300 border-danger-500/40 bg-danger-500/10" },
];

export default function InventoryAdjustModal({ product, open, onClose, onAdjusted }) {
  const { socket } = useSocket();
  const [type, setType] = useState("stock_in");
  const [reasonCode, setReasonCode] = useState(REASONS_BY_TYPE.stock_in[0].value);
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Fresh form every time the modal opens (or the target product changes
  // while it's open) — no leftover quantity/note from a previous adjustment.
  useEffect(() => {
    if (!open) return;
    setType("stock_in");
    setReasonCode(REASONS_BY_TYPE.stock_in[0].value);
    setQuantity("");
    setNote("");
    setSubmitError(null);
  }, [open, product?.id]);

  function handleTypeChange(nextType) {
    setType(nextType);
    // The previous reason code may not even exist for the new direction.
    setReasonCode(REASONS_BY_TYPE[nextType][0].value);
    setSubmitError(null);
  }

  const reasons = REASONS_BY_TYPE[type];
  const currentStock = product?.stock_quantity ?? 0;
  const qty = Number(quantity);
  const hasQuantity = quantity !== "";
  const isPositiveInteger = Number.isFinite(qty) && Number.isInteger(qty) && qty > 0;
  const signedDelta = isPositiveInteger ? (type === "stock_in" ? qty : -qty) : 0;
  const newStock = currentStock + signedDelta;
  const wouldGoNegative = isPositiveInteger && newStock < 0;

  // Live validation, computed from current state — never lets the user
  // reach Save with something the backend would reject, but the backend
  // re-validates everything independently regardless (never trust the client).
  let fieldError = null;
  if (hasQuantity) {
    if (!Number.isFinite(qty)) fieldError = "Enter a valid number.";
    else if (qty <= 0) fieldError = "Quantity must be greater than zero.";
    else if (!Number.isInteger(qty)) fieldError = "Quantity must be a whole number.";
    else if (wouldGoNegative) {
      fieldError = `Cannot remove ${qty} unit${qty === 1 ? "" : "s"}. Only ${currentStock} unit${currentStock === 1 ? "" : "s"} currently available.`;
    }
  }

  const canSubmit = isPositiveInteger && !wouldGoNegative;

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError(null);
    if (!canSubmit) return; // Save is disabled in this case, but guard anyway.

    setSubmitting(true);
    try {
      const reasonText = note.trim() ? `${reasonCode}: ${note.trim()}`.slice(0, 100) : reasonCode;
      const result = await adjustInventory(socket, { productId: product.id, type, quantity: qty, reason: reasonText });
      onAdjusted(result);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const displayError = fieldError || submitError;

  return (
    <Modal open={open} onClose={onClose} title={`Adjust stock — ${product?.name || ""}`}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-amber-50/40">Current stock</p>
          <p className="font-display text-lg font-semibold text-amber-50">{currentStock} units</p>
        </div>

        <div>
          <span className="mb-1.5 block text-sm text-amber-50/70">Adjustment type</span>
          <div role="radiogroup" aria-label="Adjustment type" className="grid grid-cols-2 gap-2">
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={type === opt.value}
                onClick={() => handleTypeChange(opt.value)}
                className={[
                  "flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors duration-150 focus-ring",
                  type === opt.value ? opt.tone : "border-white/10 text-amber-50/60 hover:border-white/20 hover:text-amber-50",
                ].join(" ")}
              >
                <Icon name={opt.icon} className="h-4 w-4" />
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <SelectField id="adjust-reason" label="Reason" value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
          {reasons.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </SelectField>

        <TextField
          id="adjust-quantity"
          label="Quantity"
          type="number"
          min="1"
          step="1"
          inputMode="numeric"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          required
        />

        <TextField id="adjust-note" label="Note" hint="Optional" value={note} onChange={(e) => setNote(e.target.value)} />

        {isPositiveInteger ? (
          <div
            className={[
              "flex flex-col gap-1.5 rounded-lg border p-3 text-sm",
              wouldGoNegative ? "border-danger-500/40 bg-danger-500/10" : "border-white/10 bg-ink-900/50",
            ].join(" ")}
          >
            <div className="flex justify-between text-amber-50/60">
              <span>Current stock</span>
              <span>{currentStock}</span>
            </div>
            <div className="flex justify-between text-amber-50/60">
              <span>Adjustment</span>
              <span className={type === "stock_in" ? "text-signal-400" : "text-danger-400"}>
                {type === "stock_in" ? "+" : "−"}
                {qty}
              </span>
            </div>
            <div className="flex justify-between border-t border-white/10 pt-1.5 font-medium text-amber-50">
              <span>New stock</span>
              <span className={wouldGoNegative ? "text-danger-400" : ""}>{newStock}</span>
            </div>
          </div>
        ) : null}

        {displayError ? (
          <p role="alert" className="text-sm text-danger-400">
            {displayError}
          </p>
        ) : null}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={submitting} disabled={!canSubmit}>
            Save adjustment
          </Button>
        </div>
      </form>
    </Modal>
  );
}
