import { useEffect, useState } from "react";
import Card from "../ui/Card.jsx";
import Button from "../ui/Button.jsx";
import Modal from "../ui/Modal.jsx";
import Badge from "../ui/Badge.jsx";
import EmptyState from "../ui/EmptyState.jsx";
import { Skeleton } from "../ui/Skeleton.jsx";
import { TextField, TextareaField, SelectField } from "../ui/Field.jsx";
import { useToast } from "../ui/ToastContext.js";
import * as adminApi from "../../features/admin/adminApi.js";
import { formatDate, formatMoney } from "../../features/merchant/format.js";
import KpiCard from "./KpiCard.jsx";

const PAYMENT_METHOD_LABELS = {
  BANK_TRANSFER: "Bank Transfer",
  PAY_ON_DELIVERY: "Pay on Delivery",
  PAY_ON_PICKUP: "Pay on Pickup",
};

const STATEMENT_STATUS_TONE = { OPEN: "neutral", PARTIALLY_PAID: "gold", PAID: "signal", VOID: "neutral" };

function AgingTile({ label, value, tone }) {
  const toneClasses = {
    neutral: "border-white/10 bg-ink-900/40",
    warning: "border-gold-500/30 bg-gold-500/5",
    danger: "border-danger-500/30 bg-danger-500/5",
  };
  return (
    <div className={["rounded-lg border px-4 py-3", toneClasses[tone] || toneClasses.neutral].join(" ")}>
      <p className="text-xs text-amber-50/45">{label}</p>
      <p className="mt-1 font-display text-lg font-semibold text-amber-50">{formatMoney(value)}</p>
    </div>
  );
}

// Default to the most recently completed calendar month — the natural
// "issue last month's statement" action an admin takes at the start of a
// new month. Always editable before submitting. Built from local Y/M/D
// components rather than toISOString(), which converts to UTC first and
// can shift the date by a day in timezones ahead of UTC (e.g. Brunei,
// UTC+8) — a local midnight becomes the previous day once in UTC.
function defaultPeriod() {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), 0); // last day of previous month
  const start = new Date(end.getFullYear(), end.getMonth(), 1);
  const toIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { periodStart: toIso(start), periodEnd: toIso(end) };
}

function IssueStatementModal({ open, onClose, onIssued, merchantId, token }) {
  const { push } = useToast();
  const [period, setPeriod] = useState(defaultPeriod);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const result = await adminApi.issueCommissionStatement(token, merchantId, period);
      push({ tone: "success", message: `Statement issued — ${formatMoney(result.data.commissionAmount)} across ${result.data.orderCount} order${result.data.orderCount === 1 ? "" : "s"}.` });
      onIssued();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => (submitting ? null : onClose())}
      title="Issue Commission Statement"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} isLoading={submitting}>
            Issue Statement
          </Button>
        </>
      }
    >
      <p className="text-sm text-amber-50/70">
        Bills every currently-unbilled, paid, direct-payment order (Bank Transfer / Pay on Delivery / Pay on Pickup)
        whose payment was confirmed within this period into one statement with a due date.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <TextField id="period-start" label="Period start" type="date" value={period.periodStart} onChange={(e) => setPeriod((p) => ({ ...p, periodStart: e.target.value }))} required />
        <TextField id="period-end" label="Period end" type="date" value={period.periodEnd} onChange={(e) => setPeriod((p) => ({ ...p, periodEnd: e.target.value }))} required />
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-danger-400">
          {error}
        </p>
      ) : null}
    </Modal>
  );
}

function RecordPaymentModal({ open, onClose, onRecorded, merchantId, token, statement }) {
  const { push } = useToast();
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setAmount(statement ? String(statement.balanceDue) : "");
    setPaymentMethod("BANK_TRANSFER");
    setReference("");
    setNotes("");
    setError(null);
    // `statement` is a fresh object each render from the parent's data fetch —
    // only re-prefill when the modal actually opens, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleSubmit() {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter a valid, positive amount.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await adminApi.recordCommissionPayment(token, merchantId, statement.id, { amount: value, paymentMethod, reference: reference.trim() || undefined, notes: notes.trim() || undefined });
      push({ tone: "success", message: `${formatMoney(value)} recorded against this statement.` });
      onRecorded();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        if (submitting) return;
        onClose();
      }}
      title="Record Commission Payment"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} isLoading={submitting}>
            Record Payment
          </Button>
        </>
      }
    >
      {statement ? (
        <>
          <p className="text-sm text-amber-50/70">
            Outstanding balance: <span className="font-medium text-amber-50">{formatMoney(statement.balanceDue)}</span>. Partial payments are
            allowed — the statement stays open with the remaining balance until fully paid.
          </p>
          <div className="mt-4 flex flex-col gap-4">
            <TextField id="payment-amount" label="Amount (BND)" type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            <SelectField id="payment-method" label="Payment method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="CASH">Cash</option>
              <option value="OTHER">Other</option>
            </SelectField>
            <TextField id="payment-reference" label="Reference" hint="Optional" value={reference} onChange={(e) => setReference(e.target.value)} />
            <TextareaField id="payment-notes" label="Notes" hint="Optional — shown only in the admin history log." rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {error ? (
            <p role="alert" className="mt-3 text-sm text-danger-400">
              {error}
            </p>
          ) : null}
        </>
      ) : null}
    </Modal>
  );
}

// The commission Nanashi is owed BY the merchant — the opposite direction
// from Payouts (Nanashi owes merchant), rendered as its own section so it
// never gets visually conflated with payout figures. See
// Backend/modules/merchantFinance.module.js for the payment-routing rule
// this is built on. `status`/`data`/`error`/`refresh` come from the parent
// page's own useApiResource(getMerchantFinance) — lifted up rather than
// fetched here too, since the page's top KPI row also needs `commissionDue`
// from this same response and a second fetch would be a needless N+1.
export default function CommissionReceivableSection({ merchantId, token, status, data, error, refresh }) {
  const [issueOpen, setIssueOpen] = useState(false);
  const [paymentStatement, setPaymentStatement] = useState(null);

  if (status === "loading") {
    return (
      <Card variant="data">
        <Skeleton className="h-6 w-48" />
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </Card>
    );
  }
  if (status === "error") {
    return (
      <Card variant="data">
        <h2 className="font-display text-base font-semibold text-amber-50">Commission Receivable</h2>
        <EmptyState
          title="Couldn't load commission data"
          description={error}
          action={
            <Button variant="secondary" size="sm" onClick={refresh}>
              Try again
            </Button>
          }
          className="mt-3"
        />
      </Card>
    );
  }

  const { commissionReceivable: cr, unbilledOrders, statements } = data.data;

  return (
    <>
      <Card variant="data">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-amber-50">Commission Receivable</h2>
            <p className="text-xs text-amber-50/45">Amount this merchant owes Nanashi</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setIssueOpen(true)}>
            Issue Statement
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard label="Outstanding" value={formatMoney(cr.outstanding)} />
          <KpiCard label="Due This Month" value={formatMoney(cr.dueThisMonth)} />
          <KpiCard label="Overdue" value={formatMoney(cr.overdue)} hint={cr.overdue > 0 ? "Past due date" : undefined} />
          <KpiCard label="Paid to Nanashi" value={formatMoney(cr.paidToNanashi)} />
        </div>

        <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-amber-50/35">Commission Aging</p>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <AgingTile label="Current / 0–30 days" value={cr.aging.current} tone="neutral" />
          <AgingTile label="31–60 days" value={cr.aging.days31to60} tone="neutral" />
          <AgingTile label="61–90 days" value={cr.aging.days61to90} tone="warning" />
          <AgingTile label="90+ days" value={cr.aging.days90plus} tone="danger" />
        </div>

        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-amber-50/45">Lifetime Commission</span>
          <span className="text-amber-50/70">{formatMoney(cr.lifetimeCommission)}</span>
        </div>
      </Card>

      <Card variant="data">
        <h2 className="font-display text-base font-semibold text-amber-50">Commission Activity</h2>

        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-amber-50/35">Unbilled (not yet on a statement)</p>
        {unbilledOrders.length === 0 ? (
          <EmptyState title="Nothing unbilled" description="Every direct-payment order has already been billed." className="mt-2" />
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-amber-50/40">
                  <th className="py-2 pr-3 font-medium">Order</th>
                  <th className="py-2 pr-3 font-medium">Date</th>
                  <th className="py-2 pr-3 font-medium">Type</th>
                  <th className="py-2 pr-3 font-medium">Gross</th>
                  <th className="py-2 font-medium">Commission</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {unbilledOrders.map((o) => (
                  <tr key={o.merchantOrderId}>
                    <td className="py-2 pr-3 font-mono text-xs text-amber-50/80">{o.orderNumber}</td>
                    <td className="py-2 pr-3 text-amber-50/60">{formatDate(o.confirmedAt)}</td>
                    <td className="py-2 pr-3 text-amber-50/60">{PAYMENT_METHOD_LABELS[o.paymentMethod] || o.paymentMethod}</td>
                    <td className="py-2 pr-3 text-amber-50/80">{formatMoney(o.subtotal)}</td>
                    <td className="py-2 text-amber-50/85">{formatMoney(o.commissionAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-amber-50/35">Statements</p>
        {statements.length === 0 ? (
          <EmptyState title="No statements issued yet" description="Issue a statement to bill unbilled commission for a period." className="mt-2" />
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-amber-50/40">
                  <th className="py-2 pr-3 font-medium">Period</th>
                  <th className="py-2 pr-3 font-medium">Amount</th>
                  <th className="py-2 pr-3 font-medium">Due Date</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {statements.map((s) => (
                  <tr key={s.id}>
                    <td className="py-2 pr-3 text-amber-50/80">
                      {formatDate(s.periodStart)} – {formatDate(s.periodEnd)}
                    </td>
                    <td className="py-2 pr-3 text-amber-50/85">
                      {formatMoney(s.commissionAmount)}
                      {s.balanceDue > 0 && s.balanceDue < s.commissionAmount ? (
                        <span className="ml-1 text-xs text-amber-50/45">({formatMoney(s.balanceDue)} due)</span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3 text-amber-50/60">{formatDate(s.dueDate)}</td>
                    <td className="py-2 pr-3">
                      <Badge tone={s.isOverdue ? "danger" : STATEMENT_STATUS_TONE[s.status] || "neutral"}>{s.isOverdue ? "Overdue" : s.status.replace("_", " ")}</Badge>
                    </td>
                    <td className="py-2">
                      {s.balanceDue > 0 && s.status !== "VOID" ? (
                        <Button variant="link" size="sm" onClick={() => setPaymentStatement(s)}>
                          Record Payment
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <IssueStatementModal open={issueOpen} onClose={() => setIssueOpen(false)} onIssued={refresh} merchantId={merchantId} token={token} />
      <RecordPaymentModal open={Boolean(paymentStatement)} onClose={() => setPaymentStatement(null)} onRecorded={refresh} merchantId={merchantId} token={token} statement={paymentStatement} />
    </>
  );
}
