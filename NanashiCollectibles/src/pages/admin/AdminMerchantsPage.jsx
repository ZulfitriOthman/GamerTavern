import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import SectionHeading from "../../components/ui/SectionHeading.jsx";
import { TextField } from "../../components/ui/Field.jsx";
import Button from "../../components/ui/Button.jsx";
import DataTable from "../../components/ui/DataTable.jsx";
import Pagination from "../../components/ui/Pagination.jsx";
import StatusBadge from "../../components/ui/StatusBadge.jsx";
import { useAuth } from "../../features/auth/AuthContext.js";
import { useApiResource } from "../../features/merchant/useApiResource.js";
import * as adminApi from "../../features/admin/adminApi.js";
import { formatDate } from "../../features/merchant/format.js";

const FILTERS = [
  { value: "", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "ACTIVE", label: "Active" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "BANNED", label: "Banned" },
  { value: "REJECTED", label: "Rejected" },
];

export default function AdminMerchantsPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const status = searchParams.get("status") || "";
  const page = Number(searchParams.get("page")) || 1;
  const searchParam = searchParams.get("search") || "";
  const [searchInput, setSearchInput] = useState(searchParam);

  const { status: loadStatus, data, error, refresh } = useApiResource(
    () => adminApi.getMerchants(token, { status, search: searchParam, page, limit: 20 }),
    [token, status, searchParam, page]
  );

  function updateParams(patch) {
    const params = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    params.delete("page");
    setSearchParams(params);
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    updateParams({ search: searchInput.trim() });
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading eyebrow="Merchants" title="Merchant Applications" size="section" />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => updateParams({ status: f.value })}
              className={[
                "rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors duration-150 focus-ring",
                status === f.value
                  ? "border-brand-400/50 bg-brand-500/15 text-amber-50"
                  : "border-white/10 text-amber-50/60 hover:border-white/20 hover:text-amber-50",
              ].join(" ")}
            >
              {f.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearchSubmit} className="flex items-end gap-2 sm:w-80">
          <div className="flex-1">
            <TextField
              id="admin-merchant-search"
              label="Search"
              hint="Business name, email, contact person, or merchant ID"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search merchants…"
            />
          </div>
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>
      </div>

      <DataTable
        status={loadStatus}
        error={error}
        rows={data?.data?.items || []}
        emptyTitle="No merchants found"
        emptyDescription={status || searchParam ? "Try a different filter or search term." : "Merchant registrations will appear here."}
        onRowClick={(row) => navigate(`/admin/merchants/${row.id}`)}
        onRetry={refresh}
        columns={[
          { key: "business_name", header: "Business", render: (r) => r.business_name },
          { key: "contact_person", header: "Contact Person", render: (r) => r.contact_person || "—", mobileHidden: true },
          { key: "email", header: "Email", render: (r) => r.email },
          { key: "phone", header: "Phone", render: (r) => r.phone || "—", mobileHidden: true },
          { key: "business_category", header: "Category", render: (r) => r.business_category || "—", mobileHidden: true },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
          { key: "created_at", header: "Registered", render: (r) => formatDate(r.created_at) },
          {
            key: "actions",
            header: "Actions",
            render: (r) => (
              <Button to={`/admin/merchants/${r.id}`} variant="secondary" size="sm" onClick={(e) => e.stopPropagation()}>
                View
              </Button>
            ),
          },
        ]}
      />

      <Pagination
        pagination={data?.data?.pagination}
        onPageChange={(p) =>
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set("page", p);
            return next;
          })
        }
      />
    </div>
  );
}
