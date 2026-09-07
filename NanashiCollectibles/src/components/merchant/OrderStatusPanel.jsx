import { useState } from "react";
import Card from "../ui/Card.jsx";
import Button from "../ui/Button.jsx";
import { TextField, SelectField } from "../ui/Field.jsx";
import StatusBadge from "../ui/StatusBadge.jsx";
import { nextStatusOptions } from "../../features/merchant/orderTransitions.js";

// Only shows transitions valid from the current status (see orderTransitions.js) —
// the backend re-validates and rejects anything else regardless, but this avoids
// offering a choice that would just bounce back with an error.
export default function OrderStatusPanel({ order, onUpdate, updating }) {
  const options = nextStatusOptions(order.status);
  const [nextStatus, setNextStatus] = useState(options[0] || "");
  const [trackingNumber, setTrackingNumber] = useState(order.shipment?.tracking_number || "");
  const [carrier, setCarrier] = useState(order.shipment?.carrier || "");
  const [error, setError] = useState(null);

  if (!options.length) {
    return (
      <Card variant="data">
        <h2 className="font-display text-base font-semibold text-amber-50">Fulfillment status</h2>
        <div className="mt-3">
          <StatusBadge status={order.status} />
        </div>
        <p className="mt-2 text-xs text-amber-50/45">This order is in a final state and can't be moved further.</p>
      </Card>
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    try {
      await onUpdate({ status: nextStatus, trackingNumber: trackingNumber || undefined, carrier: carrier || undefined });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Card variant="data">
      <h2 className="font-display text-base font-semibold text-amber-50">Fulfillment status</h2>
      <div className="mt-3">
        <StatusBadge status={order.status} />
      </div>

      <form onSubmit={handleSubmit} noValidate className="mt-4 flex flex-col gap-3">
        <SelectField id="order-next-status" label="Move to" value={nextStatus} onChange={(e) => setNextStatus(e.target.value)}>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </SelectField>

        {nextStatus === "SHIPPED" ? (
          <>
            <TextField id="order-carrier" label="Courier" hint="Optional" value={carrier} onChange={(e) => setCarrier(e.target.value)} />
            <TextField id="order-tracking" label="Tracking number" hint="Optional — manual tracking only" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} />
          </>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm text-danger-400">
            {error}
          </p>
        ) : null}

        <Button type="submit" isLoading={updating} size="sm" className="self-start">
          Update status
        </Button>
      </form>
    </Card>
  );
}
