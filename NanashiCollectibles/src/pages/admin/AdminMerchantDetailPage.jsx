import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import SectionHeading from "../../components/ui/SectionHeading.jsx";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import Modal from "../../components/ui/Modal.jsx";
import StatusBadge from "../../components/ui/StatusBadge.jsx";
import Badge from "../../components/ui/Badge.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import { Skeleton, SkeletonText } from "../../components/ui/Skeleton.jsx";
import { TextField, TextareaField, SelectField } from "../../components/ui/Field.jsx";
import { useToast } from "../../components/ui/ToastContext.js";
import { useAuth } from "../../features/auth/AuthContext.js";
import { useApiResource } from "../../features/merchant/useApiResource.js";
import * as adminApi from "../../features/admin/adminApi.js";
import { formatDate, formatDateTime, formatMoney } from "../../features/merchant/format.js";
import KpiCard from "../../components/admin/KpiCard.jsx";
import DateRangeTabs from "../../components/admin/DateRangeTabs.jsx";
import RevenueTrendChart from "../../components/merchant/RevenueTrendChart.jsx";
import CommissionReceivableSection from "../../components/admin/CommissionReceivableSection.jsx";

// Reason vocabulary from the admin spec — sent to the backend as the reason
// string itself (shown verbatim in the audit history), not an internal code.
const REASON_OPTIONS = [
  "Customer dispute under investigation",
  "Fraud suspicion",
  "Policy violation",
  "Order fulfilment problem",
  "Payment issue",
  "Other",
];

// Which action buttons a merchant's CURRENT status offers, and how each one
// behaves. Mirrors Backend/modules/orderStateMachine.module.js's
// MERCHANT_TRANSITIONS — the backend remains the sole authority and rejects
// anything invalid regardless of what this shows.
const STATUS_ACTIONS = {
  PENDING: [
    { targetStatus: "ACTIVE", label: "Approve Merchant", pastTense: "approved", variant: "primary" },
    { targetStatus: "REJECTED", label: "Reject Merchant", pastTense: "rejected", variant: "danger" },
  ],
  REJECTED: [{ targetStatus: "ACTIVE", label: "Approve Merchant", pastTense: "approved", variant: "primary" }],
  ACTIVE: [
    { targetStatus: "SUSPENDED", label: "Suspend Merchant", pastTense: "suspended", variant: "danger", requiresReason: true },
    {
      targetStatus: "BANNED",
      label: "Ban Merchant",
      pastTense: "banned",
      variant: "danger",
      requiresReason: true,
      requiresTypedConfirmation: true,
    },
  ],
  SUSPENDED: [
    { targetStatus: "ACTIVE", label: "Reactivate Merchant", pastTense: "reactivated", variant: "primary" },
    {
      targetStatus: "BANNED",
      label: "Ban Merchant",
      pastTense: "banned",
      variant: "danger",
      requiresReason: true,
      requiresTypedConfirmation: true,
    },
  ],
  BANNED: [{ targetStatus: "ACTIVE", label: "Unban Merchant", pastTense: "unbanned", variant: "secondary", requiresReason: true }],
};

const REVIEW_COPY = {
  PENDING: "This merchant is awaiting approval.",
  ACTIVE: "This merchant is active and can access merchant functionality.",
  SUSPENDED:
    "This merchant is suspended. Their staff retain read-only access to the dashboard, but cannot list products, receive new orders, or process payouts.",
  BANNED: "This merchant is permanently banned and has no access to merchant functionality.",
  REJECTED: "This merchant's application was rejected.",
};

const PAYMENT_METHOD_LABELS = {
  BANK_TRANSFER: "Bank Transfer",
  ONLINE_PAYMENT: "Online Payment",
  PAY_ON_DELIVERY: "Pay on Delivery",
  PAY_ON_PICKUP: "Pay on Pickup",
};

function parseSocialLinks(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    // not JSON — fall through to raw string display
  }
  return { raw };
}

function DetailRow({ label, value }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <dt className="text-amber-50/45">{label}</dt>
      <dd className="text-right text-amber-50/85">{value ?? "—"}</dd>
    </div>
  );
}

function StatTile({ label, value }) {
  return (
    <div className="rounded-lg border border-white/10 bg-ink-900/40 px-4 py-3 text-center">
      <p className="font-display text-xl font-semibold text-amber-50">{value}</p>
      <p className="mt-1 text-xs text-amber-50/45">{label}</p>
    </div>
  );
}

function FinancialLine({ label, value, muted }) {
  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <span className={muted ? "text-amber-50/40" : "text-amber-50/60"}>{label}</span>
      <span className={muted ? "text-amber-50/40" : "font-medium text-amber-50/90"}>{value}</span>
    </div>
  );
}

export default function AdminMerchantDetailPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const { push } = useToast();

  const { status, data, error, refresh } = useApiResource(() => adminApi.getMerchant(token, id), [token, id]);

  const [range, setRange] = useState("30d");
  const [chartMetric, setChartMetric] = useState("sales"); // "sales" | "orders"
  const {
    status: analyticsStatus,
    data: analyticsData,
    error: analyticsError,
    refresh: refreshAnalytics,
  } = useApiResource(() => adminApi.getMerchantAnalytics(token, id, { range }), [token, id, range]);

  // Commission Receivable — lifetime/current-balance data, deliberately NOT
  // affected by the `range` performance filter above (see item 21: aging
  // must represent the outstanding receivable as of today, not be hidden
  // by a "last 30 days" window).
  const {
    status: financeStatus,
    data: financeData,
    error: financeError,
    refresh: refreshFinance,
  } = useApiResource(() => adminApi.getMerchantFinance(token, id), [token, id]);

  const [action, setAction] = useState(null); // one of STATUS_ACTIONS[status] entries, or null
  const [reason, setReason] = useState(REASON_OPTIONS[0]);
  const [notes, setNotes] = useState("");
  const [banConfirmText, setBanConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const merchant = data?.data?.merchant;
  const addresses = data?.data?.addresses || [];
  const history = data?.data?.history || [];
  const merchantUsers = data?.data?.merchantUsers || [];
  const productStats = data?.data?.productStats;
  const reviewStats = data?.data?.reviewStats;

  const analytics = analyticsData?.data;

  const availableActions = useMemo(() => (merchant ? STATUS_ACTIONS[merchant.status] || [] : []), [merchant]);
  const socialLinks = merchant ? parseSocialLinks(merchant.social_links) : null;

  function openAction(entry) {
    setReason(REASON_OPTIONS[0]);
    setNotes("");
    setBanConfirmText("");
    setSubmitError(null);
    setAction(entry);
  }

  const banConfirmReady = !action?.requiresTypedConfirmation || banConfirmText.trim().toUpperCase() === "BAN";
  const reasonReady = !action?.requiresReason || reason.trim().length > 0;

  async function handleConfirm() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await adminApi.updateMerchantStatus(token, id, {
        status: action.targetStatus,
        reason: action.requiresReason ? reason : undefined,
        notes: notes.trim() || undefined,
      });
      push({ tone: "success", message: `${merchant.business_name} ${action.pastTense}.` });
      setAction(null);
      refresh();
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="flex w-full flex-col gap-6">
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
        <SkeletonText lines={8} />
      </div>
    );
  }
  if (status === "error") {
    return (
      <EmptyState
        title="Couldn't load this merchant"
        description={error}
        action={
          <Button variant="secondary" size="sm" onClick={refresh}>
            Try again
          </Button>
        }
      />
    );
  }

  const kpis = analytics?.kpis;
  const orderBreakdown = analytics?.orderBreakdown;
  const topProducts = analytics?.topProducts || [];
  const recentOrders = analytics?.recentOrders || [];
  const payout = analytics?.payout;

  const trendData = (analytics?.salesTrend || []).map((row) => ({
    day: row.day,
    total: chartMetric === "sales" ? row.total : row.orders,
  }));

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Header */}
      <Card variant="data">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <SectionHeading eyebrow="Merchant" title={merchant.business_name} size="section" />
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-amber-50/50">
              <StatusBadge status={merchant.status} />
              {merchant.business_category ? <span>{merchant.business_category}</span> : null}
              <span>· Registered {formatDate(merchant.created_at)}</span>
            </div>
          </div>
          {availableActions.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {availableActions.map((entry) => (
                <Button key={entry.targetStatus} variant={entry.variant} size="sm" onClick={() => openAction(entry)}>
                  {entry.label}
                </Button>
              ))}
            </div>
          ) : null}
        </div>
      </Card>

      {/* KPI cards */}
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-base font-semibold text-amber-50">Performance</h2>
          <DateRangeTabs value={range} onChange={setRange} />
        </div>

        {analyticsStatus === "loading" ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : analyticsStatus === "error" ? (
          <EmptyState
            title="Couldn't load performance data"
            description={analyticsError}
            action={
              <Button variant="secondary" size="sm" onClick={refreshAnalytics}>
                Try again
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <KpiCard label="Gross Sales" value={formatMoney(kpis.grossSales)} hint="Paid, non-cancelled orders" />
            <KpiCard label="Merchant Earnings" value={formatMoney(kpis.merchantEarnings)} hint="After commission" />
            <KpiCard label="Orders" value={kpis.orderCount} />
            <KpiCard label="Avg Order Value" value={formatMoney(kpis.averageOrderValue)} />
            <KpiCard label="Pending Payout" value={formatMoney(payout.pendingPayout)} hint="Nanashi → Merchant" />
            <KpiCard
              label="Commission Due"
              value={financeStatus === "success" ? formatMoney(financeData.data.commissionReceivable.outstanding) : "—"}
              hint="Merchant → Nanashi"
            />
          </div>
        )}
      </div>

      {analyticsStatus === "success" ? (
        <>
          {/* Sales Performance | Financial Overview */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card variant="data">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-base font-semibold text-amber-50">Sales Performance</h2>
                <div className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-ink-900/40 p-1">
                  {["sales", "orders"].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setChartMetric(m)}
                      className={[
                        "rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors duration-150 focus-ring",
                        chartMetric === m ? "bg-brand-500 text-white" : "text-amber-50/60 hover:text-amber-50",
                      ].join(" ")}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-4">
                <RevenueTrendChart data={trendData} />
              </div>
            </Card>

            <Card variant="data">
              <h2 className="font-display text-base font-semibold text-amber-50">Financial Overview</h2>

              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-amber-50/35">Sales</p>
              <div className="flex flex-col divide-y divide-white/5">
                <FinancialLine label="Gross Sales" value={formatMoney(kpis.grossSales)} />
                <FinancialLine label="Platform Commission" value={formatMoney(kpis.platformCommission)} />
                <FinancialLine label="Merchant Earnings" value={formatMoney(kpis.merchantEarnings)} />
              </div>

              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-amber-50/35">Nanashi Owes Merchant</p>
              <div className="flex flex-col divide-y divide-white/5">
                <FinancialLine label="Paid Out" value={formatMoney(payout.paidOut)} />
                <FinancialLine label="Pending Payout" value={formatMoney(payout.pendingPayout)} />
              </div>

              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-amber-50/35">Merchant Owes Nanashi</p>
              <div className="flex flex-col divide-y divide-white/5">
                <FinancialLine
                  label="Commission Due"
                  value={financeStatus === "success" ? formatMoney(financeData.data.commissionReceivable.outstanding) : "—"}
                />
                <FinancialLine
                  label="Overdue Commission"
                  value={financeStatus === "success" ? formatMoney(financeData.data.commissionReceivable.overdue) : "—"}
                />
              </div>

              <div className="mt-4 flex flex-col divide-y divide-white/5">
                <FinancialLine label="Refunds" value={analytics.refundsAvailable ? formatMoney(0) : "Not currently available"} muted={!analytics.refundsAvailable} />
              </div>

              <p className="mt-3 text-[11px] leading-relaxed text-amber-50/35">
                Sales figures reflect the selected period above; every other line here is a lifetime/current-balance
                figure. Bank Transfer/Pay on Delivery/Pay on Pickup funds are never held by Nanashi — those never
                appear under Pending Payout, only under Commission Due. Paid Out/Pending Payout come from the
                manually-recorded payout ledger; Commission Due/Overdue come from the Commission Receivable section
                below.
              </p>
            </Card>
          </div>

          {/* Orders breakdown | Recent Orders */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card variant="data">
              <h2 className="font-display text-base font-semibold text-amber-50">Orders</h2>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <StatTile label="Total" value={orderBreakdown.total} />
                <StatTile label="Paid" value={orderBreakdown.paid} />
                <StatTile label="Awaiting Payment" value={orderBreakdown.awaitingPayment} />
                <StatTile label="Processing" value={orderBreakdown.processing} />
                <StatTile label="Completed" value={orderBreakdown.completed} />
                <StatTile label="Cancelled" value={orderBreakdown.cancelled} />
              </div>
              <p className="mt-3 text-[11px] text-amber-50/35">
                "Paid"/"Awaiting Payment" reflect payment confirmation; "Processing"/"Completed"/"Cancelled" reflect
                fulfilment stage — an order can be Paid and still Processing at the same time.
              </p>
            </Card>

            <Card variant="data">
              <h2 className="font-display text-base font-semibold text-amber-50">Recent Orders</h2>
              {recentOrders.length === 0 ? (
                <EmptyState title="No recent orders" description="This merchant hasn't received any orders yet." className="mt-3" />
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[480px] text-left text-sm">
                    <thead>
                      <tr className="text-xs uppercase tracking-wide text-amber-50/40">
                        <th className="py-2 pr-3 font-medium">Order</th>
                        <th className="py-2 pr-3 font-medium">Date</th>
                        <th className="py-2 pr-3 font-medium">Customer</th>
                        <th className="py-2 pr-3 font-medium">Amount</th>
                        <th className="py-2 pr-3 font-medium">Payment</th>
                        <th className="py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {recentOrders.map((o) => (
                        <tr key={o.orderNumber}>
                          <td className="py-2 pr-3 font-mono text-xs text-amber-50/80">{o.orderNumber}</td>
                          <td className="py-2 pr-3 text-amber-50/60">{formatDate(o.createdAt)}</td>
                          <td className="max-w-[120px] truncate py-2 pr-3 text-amber-50/70">{o.customerName}</td>
                          <td className="py-2 pr-3 text-amber-50/85">{formatMoney(o.amount)}</td>
                          <td className="py-2 pr-3 text-amber-50/60">{PAYMENT_METHOD_LABELS[o.paymentMethod] || o.paymentMethod}</td>
                          <td className="py-2">
                            <StatusBadge status={o.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          {/* Top Products | Catalog Health */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card variant="data">
              <h2 className="font-display text-base font-semibold text-amber-50">Top Products</h2>
              {topProducts.length === 0 ? (
                <EmptyState title="No completed sales yet" description="Top products appear once this merchant has paid, non-cancelled orders." className="mt-3" />
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[420px] text-left text-sm">
                    <thead>
                      <tr className="text-xs uppercase tracking-wide text-amber-50/40">
                        <th className="py-2 pr-3 font-medium">Product</th>
                        <th className="py-2 pr-3 font-medium">Units Sold</th>
                        <th className="py-2 pr-3 font-medium">Sales</th>
                        <th className="py-2 font-medium">Stock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {topProducts.map((p) => (
                        <tr key={p.productId}>
                          <td className="max-w-[180px] truncate py-2 pr-3 text-amber-50/85">{p.name}</td>
                          <td className="py-2 pr-3 text-amber-50/70">{p.unitsSold}</td>
                          <td className="py-2 pr-3 text-amber-50/85">{formatMoney(p.sales)}</td>
                          <td className="py-2 text-amber-50/50">{p.stockQuantity ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card variant="data">
              <h2 className="font-display text-base font-semibold text-amber-50">Catalog Health</h2>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <StatTile label="Total Products" value={productStats.total} />
                <StatTile label="Active" value={productStats.active} />
                <StatTile label="Archived" value={productStats.archived} />
                <StatTile label="Out of Stock" value={productStats.outOfStock} />
                <StatTile label="Low Stock" value={productStats.lowStock} />
                <StatTile label="Draft" value={productStats.draft} />
              </div>
            </Card>
          </div>

          {/* Reviews | Payouts */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card variant="data">
              <h2 className="font-display text-base font-semibold text-amber-50">Reviews</h2>
              {reviewStats.total === 0 ? (
                <EmptyState title="No reviews yet" className="mt-3" />
              ) : (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <StatTile label="Average Rating" value={reviewStats.averageRating != null ? reviewStats.averageRating.toFixed(1) : "—"} />
                  <StatTile label="Total Reviews" value={reviewStats.total} />
                </div>
              )}
            </Card>

            <Card variant="data">
              <h2 className="font-display text-base font-semibold text-amber-50">Payouts</h2>
              <div className="mt-2 flex flex-col divide-y divide-white/5">
                <FinancialLine label="Merchant Earnings (lifetime)" value={formatMoney(kpis.merchantEarnings)} muted />
                <FinancialLine label="Paid Out" value={formatMoney(payout.paidOut)} />
                <FinancialLine label="Pending Payout" value={formatMoney(payout.pendingPayout)} />
                <FinancialLine
                  label="Last Payout"
                  value={payout.lastPayoutAmount != null ? `${formatMoney(payout.lastPayoutAmount)} · ${formatDate(payout.lastPayoutAt)}` : "No payouts yet"}
                />
              </div>
            </Card>
          </div>
        </>
      ) : null}

      {/* Commission Receivable | Commission Activity — a current-balance
          view, deliberately independent of the Performance date range
          above (see item 21). */}
      <div className="grid gap-6 lg:grid-cols-2">
        <CommissionReceivableSection
          merchantId={id}
          token={token}
          status={financeStatus}
          data={financeData}
          error={financeError}
          refresh={refreshFinance}
        />
      </div>

      {/* Business Details | Admin Review */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card variant="data">
          <h2 className="font-display text-base font-semibold text-amber-50">Business Details</h2>

          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-amber-50/35">Business</p>
          <dl className="flex flex-col divide-y divide-white/5">
            <DetailRow label="Business Name" value={merchant.business_name} />
            <DetailRow label="Display Name" value={merchant.display_name} />
            <DetailRow label="Category" value={merchant.business_category} />
            <DetailRow label="Registration Date" value={formatDateTime(merchant.created_at)} />
          </dl>

          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-amber-50/35">Contact</p>
          <dl className="flex flex-col divide-y divide-white/5">
            <DetailRow label="Contact Person" value={merchant.contact_person} />
            <DetailRow label="Email" value={merchant.email} />
            <DetailRow label="Phone" value={merchant.phone} />
          </dl>

          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-amber-50/35">Platform</p>
          <dl className="flex flex-col divide-y divide-white/5">
            <DetailRow label="Status" value={<StatusBadge status={merchant.status} />} />
            <DetailRow
              label="Commission"
              value={merchant.commission_percent != null ? `${merchant.commission_percent}% (override)` : "Platform default"}
            />
            <DetailRow label="Last Updated" value={formatDateTime(merchant.updated_at)} />
            <DetailRow label="Slug" value={<span className="text-xs text-amber-50/45">{merchant.slug}</span>} />
          </dl>

          {socialLinks ? (
            <>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-amber-50/35">Social Links</p>
              {socialLinks.raw ? (
                <p className="mt-1 break-all text-sm text-amber-50/70">{socialLinks.raw}</p>
              ) : (
                <dl className="flex flex-col divide-y divide-white/5">
                  {Object.entries(socialLinks).map(([key, value]) => (
                    <DetailRow key={key} label={key} value={String(value)} />
                  ))}
                </dl>
              )}
            </>
          ) : null}
        </Card>

        <Card variant="data">
          <h2 className="font-display text-base font-semibold text-amber-50">Admin Review</h2>
          <p className="mt-2 text-sm text-amber-50/60">{REVIEW_COPY[merchant.status] || REVIEW_COPY.SUSPENDED}</p>
          {availableActions.length === 0 ? (
            <p className="mt-4 text-xs text-amber-50/45">No further status changes are available for this merchant from here.</p>
          ) : (
            <p className="mt-4 text-xs text-amber-50/45">Use the actions in the header above to change this merchant's status.</p>
          )}
        </Card>
      </div>

      {/* Merchant Users | Registered Address */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card variant="data">
          <h2 className="font-display text-base font-semibold text-amber-50">Merchant Users</h2>
          {merchantUsers.length === 0 ? (
            <EmptyState title="No staff members recorded" className="mt-3" />
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[320px] text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-amber-50/40">
                    <th className="py-2 pr-3 font-medium">Name</th>
                    <th className="py-2 pr-3 font-medium">Email</th>
                    <th className="py-2 font-medium">Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {merchantUsers.map((u) => (
                    <tr key={u.id}>
                      <td className="py-2 pr-3 text-amber-50/85">{u.name}</td>
                      <td className="max-w-[160px] truncate py-2 pr-3 text-amber-50/60">{u.email}</td>
                      <td className="py-2">
                        <span className="text-amber-50/70">{u.role.replace("MERCHANT_", "")}</span>
                        {u.status !== "active" ? (
                          <Badge tone="neutral" className="ml-2">
                            {u.status}
                          </Badge>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card variant="data">
          <h2 className="font-display text-base font-semibold text-amber-50">Registered Address</h2>
          {addresses.length === 0 ? (
            <EmptyState title="No address on file" className="mt-3" />
          ) : (
            <div className="mt-3 flex flex-col gap-4">
              {addresses.map((addr) => (
                <div key={addr.id} className="flex flex-col gap-1 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-amber-50/85">{addr.label || "Address"}</span>
                    {addr.is_default ? <Badge tone="signal">Default</Badge> : null}
                  </div>
                  <p className="text-amber-50/70">
                    {[addr.address_line1, addr.village, addr.mukim, addr.district, addr.postcode, addr.country_code]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Administrative History */}
      <Card variant="data">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-base font-semibold text-amber-50">Administrative History</h2>
        </div>
        {history.length === 0 ? (
          <EmptyState title="No administrative history yet" className="mt-3" />
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            {history.map((h) => (
              <div key={h.id} className="flex items-start gap-3 text-sm">
                <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                <div>
                  <p className="text-amber-50/80">
                    {h.metadata?.previousStatus ? `${h.metadata.previousStatus} → ${h.metadata.newStatus}` : h.action}
                  </p>
                  <p className="text-xs text-amber-50/45">
                    {formatDateTime(h.created_at)} · {h.actor_name || h.actor_email || "System"}
                    {h.metadata?.reason ? ` · "${h.metadata.reason}"` : ""}
                  </p>
                  {h.metadata?.notes ? <p className="mt-0.5 text-xs text-amber-50/40">{h.metadata.notes}</p> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={Boolean(action)}
        onClose={() => (submitting ? null : setAction(null))}
        title={action ? `${action.label}?` : ""}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAction(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              variant={action?.variant === "danger" ? "danger" : "primary"}
              onClick={handleConfirm}
              isLoading={submitting}
              disabled={!banConfirmReady || !reasonReady}
            >
              {action?.label.split(" ")[0]}
            </Button>
          </>
        }
      >
        {action ? (
          <>
            <p className="text-sm text-amber-50/70">
              {action.targetStatus === "ACTIVE" && merchant.status === "PENDING"
                ? "This merchant will be allowed to access marketplace features."
                : action.targetStatus === "REJECTED"
                ? "This merchant's application will be marked as rejected. Their registration record is kept, not deleted."
                : action.targetStatus === "SUSPENDED"
                ? "This merchant will immediately lose the ability to list products, receive new orders, or process payouts. Read-only dashboard access remains available to their staff."
                : action.targetStatus === "BANNED"
                ? "This is a permanent block. The merchant will lose all marketplace access, including read-only dashboard access. Historical orders, products, and payout records are preserved, not deleted."
                : action.targetStatus === "ACTIVE" && merchant.status === "BANNED"
                ? "This reverses a permanent ban and restores full marketplace access. This is an explicit, audited action."
                : "This restores full marketplace access for this merchant."}
            </p>

            {action.requiresReason ? (
              <div className="mt-4">
                <SelectField id="status-reason" label="Reason" required value={reason} onChange={(e) => setReason(e.target.value)}>
                  {REASON_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </SelectField>
              </div>
            ) : null}

            <div className="mt-4">
              <TextareaField
                id="status-notes"
                label="Admin notes"
                hint="Optional — shown only in the admin history log."
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {action.requiresTypedConfirmation ? (
              <div className="mt-4">
                <TextField
                  id="ban-confirm-text"
                  label={`Type "BAN" to confirm this permanent action`}
                  value={banConfirmText}
                  onChange={(e) => setBanConfirmText(e.target.value)}
                  autoComplete="off"
                />
              </div>
            ) : null}

            {submitError ? (
              <p role="alert" className="mt-3 text-sm text-danger-400">
                {submitError}
              </p>
            ) : null}
          </>
        ) : null}
      </Modal>
    </div>
  );
}
