import { useNavigate, useSearchParams } from "react-router-dom";
import SectionHeading from "../../components/ui/SectionHeading.jsx";
import { SelectField } from "../../components/ui/Field.jsx";
import DataTable from "../../components/ui/DataTable.jsx";
import Pagination from "../../components/ui/Pagination.jsx";
import StatusBadge from "../../components/ui/StatusBadge.jsx";
import { useMerchantAuth } from "../../features/merchant/MerchantAuthContext.js";
import { useApiResource } from "../../features/merchant/useApiResource.js";
import * as merchantApi from "../../features/merchant/merchantApi.js";
import { formatMoney, formatDate } from "../../features/merchant/format.js";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "PROCESSING", label: "Processing" },
  { value: "READY", label: "Ready" },
  { value: "SHIPPED", label: "Shipped" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CANCELLED", label: "Cancelled" },
];

export default function MerchantOrdersListPage() {
  const { token, activeMerchant } = useMerchantAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const page = Number(searchParams.get("page")) || 1;
  const status = searchParams.get("status") || "";

  const { status: loadStatus, data, error } = useApiResource(
    () => merchantApi.getOrders(token, { page, limit: 20, status, merchantId: activeMerchant?.merchantId }),
    [token, page, status, activeMerchant?.merchantId]
  );

  function updateStatus(value) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set("status", value);
    else params.delete("status");
    params.delete("page");
    setSearchParams(params);
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading eyebrow="Fulfillment" title="Orders" size="section" />

      <div className="sm:w-56">
        <SelectField id="order-status-filter" label="Status" value={status} onChange={(e) => updateStatus(e.target.value)}>
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </SelectField>
      </div>

      <DataTable
        status={loadStatus}
        error={error}
        rows={data?.data?.items || []}
        emptyTitle="No orders yet"
        emptyDescription="Orders will appear here once customers check out."
        onRowClick={(row) => navigate(`/merchant/orders/${row.id}`)}
        columns={[
          { key: "merchant_order_number", header: "Order", render: (r) => r.merchant_order_number },
          { key: "order_number", header: "Customer order", render: (r) => r.order_number, mobileHidden: true },
          { key: "created_at", header: "Date", render: (r) => formatDate(r.created_at) },
          { key: "merchant_net_amount", header: "Net total", render: (r) => formatMoney(r.merchant_net_amount) },
          { key: "payment_status", header: "Payment", render: (r) => <StatusBadge status={r.payment_status} /> },
          { key: "status", header: "Fulfillment", render: (r) => <StatusBadge status={r.status} /> },
        ]}
      />

      <Pagination pagination={data?.data?.pagination} onPageChange={(p) => setSearchParams((prev) => { const next = new URLSearchParams(prev); next.set("page", p); return next; })} />
    </div>
  );
}
