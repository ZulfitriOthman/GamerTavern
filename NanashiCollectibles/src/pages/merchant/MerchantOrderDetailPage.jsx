import { useState } from "react";
import { useParams } from "react-router-dom";
import SectionHeading from "../../components/ui/SectionHeading.jsx";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import Modal from "../../components/ui/Modal.jsx";
import StatusBadge from "../../components/ui/StatusBadge.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import { SkeletonText } from "../../components/ui/Skeleton.jsx";
import OrderStatusPanel from "../../components/merchant/OrderStatusPanel.jsx";
import { useMerchantAuth } from "../../features/merchant/MerchantAuthContext.js";
import { useApiResource } from "../../features/merchant/useApiResource.js";
import * as merchantApi from "../../features/merchant/merchantApi.js";
import { useToast } from "../../components/ui/ToastContext.js";
import { formatMoney, formatDateTime } from "../../features/merchant/format.js";
import { resolveUploadUrl } from "../../features/shop/productImage.js";
import { formatAddressLines } from "../../features/checkout/addressFormat.js";

// Confirmable = the payment record's status has a real PENDING/AWAITING
// transition to PAID (see Backend/modules/orderStateMachine.module.js
// MERCHANT_ORDER_PAYMENT_TRANSITIONS) — mirrors the backend's own check
// rather than hardcoding one method's status name here.
const CONFIRMABLE_PAYMENT_STATUSES = ["AWAITING_TRANSFER", "PENDING"];

const PAYMENT_METHOD_LABELS = {
  BANK_TRANSFER: "Bank Transfer",
  PAY_ON_DELIVERY: "Pay on Delivery",
  PAY_ON_PICKUP: "Pay on Pickup",
  ONLINE_PAYMENT: "Online Payment",
};

const CONFIRM_BUTTON_LABELS = {
  BANK_TRANSFER: "Confirm Bank Transfer Received",
  PAY_ON_DELIVERY: "Confirm Delivery Payment Received",
  PAY_ON_PICKUP: "Confirm Pickup Payment Received",
};

export default function MerchantOrderDetailPage() {
  const { id } = useParams();
  const { token, activeMerchant } = useMerchantAuth();
  const { push } = useToast();
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  const { status, data, error, refresh } = useApiResource(
    () => merchantApi.getOrder(token, id, { merchantId: activeMerchant?.merchantId }),
    [token, id, activeMerchant?.merchantId]
  );

  async function handleUpdate(fields) {
    await merchantApi.updateOrderStatus(token, id, fields, { merchantId: activeMerchant?.merchantId });
    push({ tone: "success", message: `Order moved to ${fields.status}.` });
    refresh();
  }

  async function handleConfirmPayment() {
    setConfirmingPayment(true);
    try {
      await merchantApi.confirmOrderPayment(token, id, { merchantId: activeMerchant?.merchantId });
      push({ tone: "success", message: "Payment confirmed." });
      setConfirmModalOpen(false);
      refresh();
    } catch (err) {
      push({ tone: "error", message: err.message });
    } finally {
      setConfirmingPayment(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="max-w-3xl">
        <SkeletonText lines={6} />
      </div>
    );
  }
  if (status === "error") {
    return (
      <EmptyState
        title="Couldn't load this order"
        description={error}
        action={
          <Button variant="secondary" size="sm" onClick={refresh}>
            Try again
          </Button>
        }
      />
    );
  }

  const order = data.data;

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <SectionHeading eyebrow={`Customer order ${order.order_number}`} title={order.merchant_order_number} size="section" />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-6">
          <Card variant="data">
            <h2 className="font-display text-base font-semibold text-amber-50">Items</h2>
            <div className="mt-4 flex flex-col divide-y divide-white/5">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate text-amber-50/85">{item.product_name_snapshot}</p>
                    <p className="text-xs text-amber-50/45">SKU {item.sku_snapshot || "—"} · Qty {item.quantity}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-amber-50/85">{formatMoney(item.line_total)}</p>
                    <p className="text-xs text-amber-50/45">{formatMoney(item.unit_price_snapshot)} each</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-col gap-1 border-t border-white/10 pt-4 text-sm">
              <div className="flex justify-between text-amber-50/60">
                <span>Subtotal</span>
                <span>{formatMoney(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-amber-50/60">
                <span>Platform commission ({order.commission_percent}%)</span>
                <span>-{formatMoney(order.commission_amount)}</span>
              </div>
              <div className="flex justify-between font-medium text-amber-50">
                <span>Your net</span>
                <span>{formatMoney(order.merchant_net_amount)}</span>
              </div>
            </div>
          </Card>

          {order.fulfilmentType ? (
            <Card variant="data">
              <h2 className="font-display text-base font-semibold text-amber-50">Fulfilment: {order.fulfilmentType === "DELIVERY" ? "Delivery" : "Pickup"}</h2>

              {order.fulfilmentType === "DELIVERY" ? (
                order.deliveryAddress ? (
                  <dl className="mt-4 flex flex-col gap-3 text-sm">
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-amber-50/40">Recipient</dt>
                      <dd className="mt-1 text-amber-50/85">{order.deliveryAddress.recipientName}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-amber-50/40">Phone</dt>
                      <dd className="mt-1 text-amber-50/85">{order.deliveryAddress.phone}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-amber-50/40">Address</dt>
                      <dd className="mt-1 text-amber-50/85">
                        {formatAddressLines(order.deliveryAddress).map((line, i) => (
                          <p key={i}>{line}</p>
                        ))}
                      </dd>
                    </div>
                    {order.delivery_instructions ? (
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-amber-50/40">Delivery instructions</dt>
                        <dd className="mt-1 text-amber-50/85">{order.delivery_instructions}</dd>
                      </div>
                    ) : null}
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-amber-50/40">Reference photo</dt>
                      <dd className="mt-1.5">
                        {order.deliveryReferencePhoto ? (
                          <a
                            href={resolveUploadUrl(order.deliveryReferencePhoto.fileUrl)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm font-medium text-brand-400 hover:text-brand-300 focus-ring rounded"
                          >
                            View image
                          </a>
                        ) : (
                          <span className="text-amber-50/45">Not provided</span>
                        )}
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <p className="mt-3 text-sm text-amber-50/45">No delivery address on file.</p>
                )
              ) : (
                <p className="mt-3 text-sm text-amber-50/60">Customer will collect this order in person.</p>
              )}
            </Card>
          ) : null}

          {order.history?.length ? (
            <Card variant="data">
              <h2 className="font-display text-base font-semibold text-amber-50">History</h2>
              <div className="mt-4 flex flex-col gap-3">
                {order.history.map((h, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm">
                    <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                    <div>
                      <p className="text-amber-50/80">
                        {h.old_status ? `${h.old_status} → ${h.new_status}` : h.new_status}
                      </p>
                      <p className="text-xs text-amber-50/45">{formatDateTime(h.created_at)} · {h.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
        </div>

        <div className="flex flex-col gap-6">
          <OrderStatusPanel order={order} onUpdate={handleUpdate} updating={false} />

          <Card variant="data">
            <h2 className="font-display text-base font-semibold text-amber-50">Payment</h2>
            <div className="mt-3">
              <StatusBadge status={order.payment_status} />
            </div>

            {order.payment ? (
              <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-amber-50/60">{PAYMENT_METHOD_LABELS[order.payment.payment_method] || order.payment.payment_method}</span>
                  <StatusBadge status={order.payment.status} />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-amber-50/60">Amount</span>
                  <span className="text-amber-50/85">{formatMoney(order.payment.amount)}</span>
                </div>
                {order.payment.reference ? (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-amber-50/60">Reference</span>
                    <span className="font-mono text-amber-50/85">{order.payment.reference}</span>
                  </div>
                ) : null}
                {CONFIRMABLE_PAYMENT_STATUSES.includes(order.payment.status) ? (
                  <Button size="sm" onClick={() => setConfirmModalOpen(true)}>
                    {CONFIRM_BUTTON_LABELS[order.payment.payment_method] || "Confirm Payment Received"}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </Card>

          <Modal
            open={confirmModalOpen}
            onClose={() => setConfirmModalOpen(false)}
            title={CONFIRM_BUTTON_LABELS[order.payment?.payment_method] || "Confirm payment received"}
            footer={
              <>
                <Button variant="secondary" onClick={() => setConfirmModalOpen(false)} disabled={confirmingPayment}>
                  Cancel
                </Button>
                <Button onClick={handleConfirmPayment} isLoading={confirmingPayment}>
                  Confirm Received
                </Button>
              </>
            }
          >
            <p className="text-sm text-amber-50/70">
              Confirm that you have received {order.payment ? formatMoney(order.payment.amount) : ""}
              {order.payment?.payment_method === "BANK_TRANSFER" ? " via bank transfer" : ""} for this order. This cannot be undone.
            </p>
          </Modal>

          {order.shipment ? (
            <Card variant="data">
              <h2 className="font-display text-base font-semibold text-amber-50">Shipment</h2>
              <dl className="mt-3 flex flex-col gap-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-amber-50/45">Carrier</dt>
                  <dd className="text-amber-50/80">{order.shipment.carrier || "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-amber-50/45">Tracking</dt>
                  <dd className="text-amber-50/80">{order.shipment.tracking_number || "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-amber-50/45">Status</dt>
                  <dd>
                    <StatusBadge status={order.shipment.status} />
                  </dd>
                </div>
              </dl>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
