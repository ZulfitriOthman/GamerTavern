import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Section from "../components/layout/Section.jsx";
import Card from "../components/ui/Card.jsx";
import Badge from "../components/ui/Badge.jsx";
import Button from "../components/ui/Button.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import Icon from "../components/ui/Icon.jsx";
import { Skeleton, SkeletonText } from "../components/ui/Skeleton.jsx";
import { useAuth } from "../features/auth/AuthContext.js";
import { getOrder } from "../features/orders/orderService.js";
import { formatMoney } from "../features/shop/format.js";
import { resolveUploadUrl } from "../features/shop/productImage.js";
import { formatAddressLines, formatAddressInline } from "../features/checkout/addressFormat.js";

const PAYMENT_STATUS_TONE = {
  PAID: "signal",
  PENDING: "gold",
  FAILED: "danger",
};

// Method-aware status copy (point 12) — a bare "PENDING" badge means
// something different for each offline method, so each gets its own
// customer-facing wording rather than one generic label.
const OFFLINE_PAYMENT_METHOD_LABELS = {
  PAY_ON_DELIVERY: "Pay on Delivery",
  PAY_ON_PICKUP: "Pay on Pickup",
};

function offlinePaymentStatusCopy(paymentMethod, status) {
  if (status === "PAID") return "Paid";
  if (paymentMethod === "PAY_ON_DELIVERY") return "Payment due on delivery";
  if (paymentMethod === "PAY_ON_PICKUP") return "Payment due on pickup";
  return status;
}

// order.items already come pre-joined with MERCHANT_ORDERS/MERCHANTS (see
// orders.routes.js) — group by merchant_order_number so the customer sees
// the same per-merchant split their order was actually fulfilled as.
function groupByMerchantOrder(items) {
  const groups = new Map();
  for (const item of items) {
    if (!groups.has(item.merchant_order_number)) {
      groups.set(item.merchant_order_number, { merchantOrderNumber: item.merchant_order_number, merchantName: item.merchant_name, status: item.merchant_order_status, items: [] });
    }
    groups.get(item.merchant_order_number).items.push(item);
  }
  return [...groups.values()];
}

export default function OrderConfirmationPage() {
  const { orderId } = useParams();
  const { token, status: authStatus } = useAuth();
  const [order, setOrder] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);

  function load() {
    if (authStatus !== "authenticated") return;
    setStatus("loading");
    getOrder({ token, orderId })
      .then((data) => {
        setOrder(data);
        setStatus("success");
      })
      .catch((err) => {
        setError(err.message);
        setStatus("error");
      });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus, token, orderId]);

  if (authStatus === "loading" || status === "loading") {
    return (
      <Section spacing="lg" containerSize="wide" className="pt-14 sm:pt-20">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          <Skeleton className="h-16 w-full rounded-xl" />
          <SkeletonText lines={6} />
        </div>
      </Section>
    );
  }

  if (authStatus !== "authenticated" || status === "error") {
    return (
      <Section spacing="lg" containerSize="wide" className="pt-14 sm:pt-20">
        <ErrorState
          icon="package"
          title="Couldn't load this order"
          description={authStatus !== "authenticated" ? "Log in to view your order confirmation." : error}
          action={authStatus !== "authenticated" ? <Button to="/login">Log in</Button> : <Button onClick={load}>Retry</Button>}
        />
      </Section>
    );
  }

  const merchantGroups = groupByMerchantOrder(order.items);

  return (
    <Section spacing="lg" containerSize="wide" className="pb-24 pt-14 sm:pt-20">
      <div className="mx-auto flex max-w-2xl flex-col gap-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-signal-500/10 text-signal-400">
            <Icon name="check" className="h-7 w-7" />
          </span>
          <h1 className="font-display text-2xl font-semibold text-amber-50 sm:text-3xl">Order confirmed</h1>
          <p className="text-sm text-amber-50/60">
            Order <span className="text-amber-50/85">{order.order_number}</span> · placed {new Date(order.placed_at || order.created_at).toLocaleString()}
          </p>
          <Badge tone={PAYMENT_STATUS_TONE[order.payment_status] || "neutral"}>Payment: {order.payment_status}</Badge>
        </div>

        <Card variant="form" className="flex flex-col gap-3 text-sm text-amber-50/70">
          <p className="font-medium text-amber-50">
            Fulfilment{order.shipping_method_name ? <span className="font-normal text-amber-50/60"> · {order.shipping_method_name}</span> : null}
          </p>

          {order.fulfilmentType === "DELIVERY" ? (
            <>
              {order.deliveryAddress ? (
                <div>
                  <p className="text-xs uppercase tracking-wide text-amber-50/40">Deliver to</p>
                  <p className="mt-1 text-amber-50/85">{order.deliveryAddress.recipientName}</p>
                  <p className="text-amber-50/70">{order.deliveryAddress.phone}</p>
                  {formatAddressLines(order.deliveryAddress).map((line, i) => (
                    <p key={i} className="text-amber-50/70">
                      {line}
                    </p>
                  ))}
                </div>
              ) : null}
              {order.delivery_instructions ? (
                <div>
                  <p className="text-xs uppercase tracking-wide text-amber-50/40">Instructions</p>
                  <p className="mt-1 text-amber-50/70">{order.delivery_instructions}</p>
                </div>
              ) : null}
              {order.deliveryReferencePhoto ? (
                <div>
                  <p className="text-xs uppercase tracking-wide text-amber-50/40">Reference photo</p>
                  <a href={resolveUploadUrl(order.deliveryReferencePhoto.fileUrl)} target="_blank" rel="noreferrer" className="mt-1.5 inline-block">
                    <img
                      src={resolveUploadUrl(order.deliveryReferencePhoto.fileUrl)}
                      alt="Delivery reference"
                      className="h-20 w-20 rounded-lg border border-white/10 object-cover"
                    />
                  </a>
                </div>
              ) : null}
            </>
          ) : order.fulfilmentType === "PICKUP" ? (
            <div className="flex flex-col gap-3">
              {order.pickupLocations?.length ? (
                order.pickupLocations.map((loc) => (
                  <div key={loc.merchantName}>
                    <p className="text-amber-50/85">{loc.merchantName}</p>
                    <p className="text-amber-50/60">{loc.address ? formatAddressInline(loc.address) : "Pickup details will be coordinated with the merchant."}</p>
                  </div>
                ))
              ) : (
                <p>Pickup details will be coordinated with the merchant.</p>
              )}
            </div>
          ) : (
            <p>Delivery or pickup arrangements will be coordinated with the merchant per order below after your order is confirmed.</p>
          )}
        </Card>

        {order.bankTransferPayments?.length ? (
          <Card variant="form" className="flex flex-col gap-5">
            <div>
              <p className="font-display text-lg font-semibold text-amber-50">Bank Transfer Instructions</p>
              <p className="mt-1 text-sm text-amber-50/60">
                Transfer the exact amount below to each merchant, then wait for them to confirm receipt. Your order
                completes once every merchant has confirmed.
              </p>
            </div>
            {order.bankTransferPayments.map((p) => (
              <div key={p.merchantOrderNumber} className="rounded-xl border border-white/10 bg-ink-900/50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-display text-base font-semibold text-amber-50">{p.merchantName}</p>
                  <Badge tone={p.status === "PAID" ? "signal" : "gold"}>{p.status === "PAID" ? "Received" : "Awaiting transfer"}</Badge>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <dt className="text-amber-50/45">Amount to transfer</dt>
                  <dd className="text-right font-medium text-amber-50">{formatMoney(p.amount)}</dd>
                  <dt className="text-amber-50/45">Bank</dt>
                  <dd className="text-right text-amber-50/85">{p.bank === "OTHER" ? p.bankOtherLabel || "Other" : p.bank}</dd>
                  <dt className="text-amber-50/45">Account name</dt>
                  <dd className="text-right text-amber-50/85">{p.displayName || p.accountName}</dd>
                  <dt className="text-amber-50/45">Account number</dt>
                  <dd className="text-right font-mono text-amber-50/85">{p.accountNumber || `****${p.accountNumberLast4 || ""}`}</dd>
                  <dt className="text-amber-50/45">Reference</dt>
                  <dd className="text-right font-mono text-amber-50/85">{p.reference}</dd>
                </dl>
              </div>
            ))}
          </Card>
        ) : null}

        {order.offlinePayments?.length ? (
          <Card variant="form" className="flex flex-col gap-5">
            <div>
              <p className="font-display text-lg font-semibold text-amber-50">Payment on delivery / pickup</p>
              <p className="mt-1 text-sm text-amber-50/60">
                No payment has been taken yet — pay the merchant directly, then they'll confirm receipt.
              </p>
            </div>
            {order.offlinePayments.map((p) => (
              <div key={p.merchantOrderNumber} className="rounded-xl border border-white/10 bg-ink-900/50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-display text-base font-semibold text-amber-50">{p.merchantName}</p>
                  <Badge tone={p.status === "PAID" ? "signal" : "gold"}>{offlinePaymentStatusCopy(p.paymentMethod, p.status)}</Badge>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <dt className="text-amber-50/45">Method</dt>
                  <dd className="text-right text-amber-50/85">{OFFLINE_PAYMENT_METHOD_LABELS[p.paymentMethod] || p.paymentMethod}</dd>
                  <dt className="text-amber-50/45">Amount</dt>
                  <dd className="text-right font-medium text-amber-50">{formatMoney(p.amount)}</dd>
                </dl>
              </div>
            ))}
          </Card>
        ) : null}

        <div className="flex flex-col gap-6">
          {merchantGroups.map((group) => (
            <Card key={group.merchantOrderNumber} variant="form">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium uppercase tracking-wide text-amber-50/40">{group.merchantName}</p>
                  <p className="text-xs text-amber-50/40">{group.merchantOrderNumber}</p>
                </div>
                <Badge tone="neutral">{group.status}</Badge>
              </div>
              <ul className="flex flex-col divide-y divide-white/5">
                {group.items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-amber-50/90">{item.product_name_snapshot}</p>
                      <p className="text-xs text-amber-50/45">
                        {item.sku_snapshot ? `${item.sku_snapshot} · ` : ""}
                        Qty {item.quantity} × {formatMoney(item.unit_price_snapshot)}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-medium text-amber-50">{formatMoney(item.line_total)}</p>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>

        <Card variant="form">
          <dl className="flex flex-col gap-2.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-amber-50/60">Subtotal</dt>
              <dd className="text-amber-50/90">{formatMoney(order.subtotal)}</dd>
            </div>
            {Number(order.discount_total) > 0 ? (
              <div className="flex justify-between">
                <dt className="text-amber-50/60">Discount</dt>
                <dd className="text-amber-50/90">−{formatMoney(order.discount_total)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt className="text-amber-50/60">Shipping</dt>
              <dd className="text-amber-50/90">{Number(order.shipping_total) === 0 ? "Free" : formatMoney(order.shipping_total)}</dd>
            </div>
          </dl>
          <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
            <span className="font-medium text-amber-50">Total</span>
            <span className="font-display text-xl font-semibold text-amber-50">{formatMoney(order.grand_total)}</span>
          </div>
        </Card>

        <div className="flex justify-center">
          <Button to="/shop" variant="secondary">
            Continue Shopping
          </Button>
        </div>
      </div>
    </Section>
  );
}
