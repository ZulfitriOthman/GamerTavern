import { useState } from "react";
import Modal from "../ui/Modal.jsx";
import Button from "../ui/Button.jsx";
import { TextField, SelectField } from "../ui/Field.jsx";
import { useSocket } from "../../services/socket/SocketContext.js";
import { adjustInventory } from "../../features/merchant/merchantProductSocketService.js";

// Backend/controllers/product.controller.js's inventory:adjust takes a single signed
// `delta` plus a free-text `reason` (inventory_movements.reason is VARCHAR(100), no
// separate notes column) — a short note here gets folded into that string rather than
// dropped, since there's nowhere else in the schema for it yet.
const REASONS = [
  { value: "STOCK_IN", label: "Stock in (restock)", sign: 1 },
  { value: "RETURN", label: "Customer return", sign: 1 },
  { value: "ADJUSTMENT", label: "Correction (damage, count fix, etc.)", sign: null },
];

export default function InventoryAdjustModal({ product, open, onClose, onAdjusted }) {
  const { socket } = useSocket();
  const [reasonCode, setReasonCode] = useState("STOCK_IN");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const reason = REASONS.find((r) => r.value === reasonCode);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty === 0) {
      setError("Enter a non-zero quantity.");
      return;
    }
    const delta = reason.sign != null ? reason.sign * Math.abs(qty) : qty;
    if (product.stock_quantity + delta < 0) {
      setError(`That would make stock negative (currently ${product.stock_quantity}).`);
      return;
    }

    setSubmitting(true);
    try {
      const reasonText = note.trim() ? `${reasonCode}: ${note.trim()}`.slice(0, 100) : reasonCode;
      const result = await adjustInventory(socket, { productId: product.id, delta, reason: reasonText });
      onAdjusted(result);
      setQuantity("");
      setNote("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Adjust stock — ${product?.name || ""}`}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <p className="text-sm text-amber-50/60">Current stock: {product?.stock_quantity}</p>

        <SelectField id="adjust-reason" label="Reason" value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
          {REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </SelectField>

        <TextField
          id="adjust-quantity"
          label={reason.sign == null ? "Adjustment amount (negative to reduce)" : "Quantity"}
          type="number"
          step="1"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          required
        />

        <TextField id="adjust-note" label="Note" hint="Optional" value={note} onChange={(e) => setNote(e.target.value)} />

        {error ? (
          <p role="alert" className="text-sm text-danger-400">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={submitting}>
            Save adjustment
          </Button>
        </div>
      </form>
    </Modal>
  );
}
