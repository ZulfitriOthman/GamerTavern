import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import SectionHeading from "../../components/ui/SectionHeading.jsx";
import Button from "../../components/ui/Button.jsx";
import { TextField, SelectField } from "../../components/ui/Field.jsx";
import DataTable from "../../components/ui/DataTable.jsx";
import Pagination from "../../components/ui/Pagination.jsx";
import StatusBadge from "../../components/ui/StatusBadge.jsx";
import { useMerchantAuth } from "../../features/merchant/MerchantAuthContext.js";
import { useApiResource } from "../../features/merchant/useApiResource.js";
import * as merchantApi from "../../features/merchant/merchantApi.js";
import { formatMoney, formatDate } from "../../features/merchant/format.js";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
  { value: "out_of_stock", label: "Out of stock" },
  { value: "archived", label: "Archived" },
];

export default function MerchantProductsListPage() {
  const { token, activeMerchant } = useMerchantAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const page = Number(searchParams.get("page")) || 1;
  const status = searchParams.get("status") || "";
  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");
  const search = searchParams.get("search") || "";

  const { status: loadStatus, data, error, refresh } = useApiResource(
    () => merchantApi.getProducts(token, { page, limit: 20, search, status, merchantId: activeMerchant?.merchantId }),
    [token, page, search, status, activeMerchant?.merchantId]
  );

  function updateParams(next) {
    const params = new URLSearchParams(searchParams);
    Object.entries(next).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    if (!("page" in next)) params.delete("page");
    setSearchParams(params);
  }

  const items = data?.data?.items || [];
  const pagination = data?.data?.pagination;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading eyebrow="Catalogue" title="Products" size="section" />
        <Button to="/merchant/products/new">New product</Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <form
          className="flex-1"
          onSubmit={(event) => {
            event.preventDefault();
            updateParams({ search: searchInput });
          }}
        >
          <TextField
            id="product-search"
            label="Search"
            placeholder="Search by name or SKU…"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </form>
        <div className="sm:w-56">
          <SelectField id="product-status-filter" label="Status" value={status} onChange={(event) => updateParams({ status: event.target.value })}>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </SelectField>
        </div>
      </div>

      <DataTable
        status={loadStatus}
        error={error}
        rows={items}
        emptyTitle={search || status ? "No products match these filters" : "No products yet"}
        emptyDescription={search || status ? "Try a different search or status." : "Create your first product to get started."}
        onRowClick={(row) => navigate(`/merchant/products/${row.id}`)}
        onRetry={refresh}
        columns={[
          { key: "name", header: "Product", render: (r) => r.name },
          { key: "code", header: "SKU", render: (r) => r.code || "—" },
          { key: "price", header: "Price", render: (r) => formatMoney(r.price) },
          {
            key: "stock",
            header: "Stock",
            render: (r) => (
              <span className={r.stock_quantity === 0 ? "text-danger-400" : r.low_stock_threshold != null && r.stock_quantity <= r.low_stock_threshold ? "text-gold-300" : ""}>
                {r.stock_quantity}
              </span>
            ),
          },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
          { key: "updated_at", header: "Updated", render: (r) => formatDate(r.updated_at), mobileHidden: true },
        ]}
      />

      <Pagination pagination={pagination} onPageChange={(p) => updateParams({ page: p })} />
    </div>
  );
}
