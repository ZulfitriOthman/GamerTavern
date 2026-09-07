import SectionHeading from "../../components/ui/SectionHeading.jsx";
import Card from "../../components/ui/Card.jsx";
import DataTable from "../../components/ui/DataTable.jsx";
import StatusBadge from "../../components/ui/StatusBadge.jsx";
import RoleGate from "../../components/merchant/RoleGate.jsx";
import { useMerchantAuth } from "../../features/merchant/MerchantAuthContext.js";
import { useApiResource } from "../../features/merchant/useApiResource.js";
import * as merchantApi from "../../features/merchant/merchantApi.js";
import { formatMoney, formatDate } from "../../features/merchant/format.js";

function PayoutsList() {
  const { token, activeMerchant } = useMerchantAuth();
  const { status, data, error } = useApiResource(
    () => merchantApi.getPayouts(token, { merchantId: activeMerchant?.merchantId }),
    [token, activeMerchant?.merchantId]
  );

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading eyebrow="Finance" title="Payouts" size="section" />

      <Card variant="data" className="border-gold-500/20 bg-gold-500/5">
        <p className="text-sm text-amber-50/70">
          Payouts are currently settled <strong className="text-amber-50">manually</strong> by NanashiCollectibles —
          there is no automatic bank transfer yet. This page reflects the payout ledger as recorded by admin.
        </p>
      </Card>

      <DataTable
        status={status}
        error={error}
        rows={data?.data || []}
        emptyTitle="No payouts recorded yet"
        emptyDescription="Payouts are created by NanashiCollectibles admin once orders in a period are eligible."
        columns={[
          { key: "period", header: "Period", render: (r) => `${formatDate(r.period_start)} – ${formatDate(r.period_end)}` },
          { key: "gross_amount", header: "Gross", render: (r) => formatMoney(r.gross_amount) },
          { key: "commission_amount", header: "Commission", render: (r) => `-${formatMoney(r.commission_amount)}` },
          { key: "net_amount", header: "Net", render: (r) => formatMoney(r.net_amount) },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
          { key: "paid_at", header: "Paid", render: (r) => formatDate(r.paid_at), mobileHidden: true },
        ]}
      />
    </div>
  );
}

export default function MerchantPayoutsPage() {
  return (
    <RoleGate allow={["MERCHANT_OWNER", "MERCHANT_ADMIN"]}>
      <PayoutsList />
    </RoleGate>
  );
}
