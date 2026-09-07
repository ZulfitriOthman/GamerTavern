import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import SectionHeading from "../../components/ui/SectionHeading.jsx";
import Button from "../../components/ui/Button.jsx";
import DataTable from "../../components/ui/DataTable.jsx";
import Pagination from "../../components/ui/Pagination.jsx";
import StatusBadge from "../../components/ui/StatusBadge.jsx";
import InventoryAdjustModal from "../../components/merchant/InventoryAdjustModal.jsx";
import { useMerchantAuth } from "../../features/merchant/MerchantAuthContext.js";
import { useApiResource } from "../../features/merchant/useApiResource.js";
import * as merchantApi from "../../features/merchant/merchantApi.js";
import { useToast } from "../../components/ui/ToastContext.js";

export default function MerchantInventoryPage() {
  const { token, activeMerchant } = useMerchantAuth();
  const { push } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [adjustingProduct, setAdjustingProduct] = useState(null);

  const page = Number(searchParams.get("page")) || 1;
  const filter = searchParams.get("filter") || ""; // low_stock | out_of_stock | ""

  const { status, data, error, refresh } = useApiResource(
    () => merchantApi.getProducts(token, { page, limit: 50, merchantId: activeMerchant?.merchantId }),
    [token, page, activeMerchant?.merchantId]
  );

  const allItems = data?.data?.items || [];
  const items = allItems.filter((p) => {
    if (filter === "low_stock") return p.stock_quantity > 0 && p.low_stock_threshold != null && p.stock_quantity <= p.low_stock_threshold;
    if (filter === "out_of_stock") return p.stock_quantity === 0;
    return true;
  });

  function updateFilter(value) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set("filter", value);
    else params.delete("filter");
    params.delete("page");
    setSearchParams(params);
  }

  function handleAdjusted(result) {
    push({ tone: "success", message: `Stock updated to ${result.stock_quantity}.` });
    setAdjustingProduct(null);
    refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading eyebrow="Stock" title="Inventory" size="section" description="Adjustments are recorded server-side — every change is auditable." />

      <div className="flex flex-wrap gap-2">
        <Button variant={filter === "" ? "primary" : "secondary"} size="sm" onClick={() => updateFilter("")}>
          All
        </Button>
        <Button variant={filter === "low_stock" ? "primary" : "secondary"} size="sm" onClick={() => updateFilter("low_stock")}>
          Low stock
        </Button>
        <Button variant={filter === "out_of_stock" ? "primary" : "secondary"} size="sm" onClick={() => updateFilter("out_of_stock")}>
          Out of stock
        </Button>
      </div>

      <DataTable
        status={status}
        error={error}
        rows={items}
        emptyTitle={filter ? "No products match this filter" : "No products yet"}
        columns={[
          { key: "name", header: "Product", render: (r) => r.name },
          { key: "code", header: "SKU", render: (r) => r.code || "—" },
          {
            key: "stock",
            header: "Current stock",
            render: (r) => (
              <span className={r.stock_quantity === 0 ? "text-danger-400" : r.low_stock_threshold != null && r.stock_quantity <= r.low_stock_threshold ? "text-gold-300" : ""}>
                {r.stock_quantity}
              </span>
            ),
          },
          { key: "low_stock_threshold", header: "Low-stock at", render: (r) => r.low_stock_threshold ?? "—" },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
          {
            key: "actions",
            header: "",
            mobileHidden: true,
            render: (r) => (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setAdjustingProduct(r);
                }}
                className="rounded text-sm font-medium text-brand-400 hover:text-brand-300 focus-ring"
              >
                Adjust stock
              </button>
            ),
          },
        ]}
      />

      <Pagination pagination={data?.data?.pagination} onPageChange={(p) => setSearchParams((prev) => ({ ...Object.fromEntries(prev), page: p }))} />

      <InventoryAdjustModal
        product={adjustingProduct}
        open={Boolean(adjustingProduct)}
        onClose={() => setAdjustingProduct(null)}
        onAdjusted={handleAdjusted}
      />
    </div>
  );
}
