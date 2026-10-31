import { useSearchParams } from "react-router-dom";
import SectionHeading from "../../components/ui/SectionHeading.jsx";
import DataTable from "../../components/ui/DataTable.jsx";
import Pagination from "../../components/ui/Pagination.jsx";
import { SelectField } from "../../components/ui/Field.jsx";
import { useAuth } from "../../features/auth/AuthContext.js";
import { useApiResource } from "../../features/merchant/useApiResource.js";
import * as adminApi from "../../features/admin/adminApi.js";
import { formatDateTime } from "../../features/merchant/format.js";

// Every action string currently written via writeAuditLog() across the backend
// (merchant approval/moderation, order status changes, settings/staff/bank
// changes) — kept here as a plain list rather than fetched, since it changes
// only when a new admin/merchant action ships.
const ACTIONS = [
  "MERCHANT_STATUS_CHANGED",
  "MERCHANT_SETTINGS_CHANGED",
  "MERCHANT_STAFF_ADDED",
  "ORDER_STATUS_CHANGED",
  "PRODUCT_ARCHIVED",
];

function describeEntry(entry) {
  if (entry.action === "MERCHANT_STATUS_CHANGED" && entry.metadata?.previousStatus) {
    return `${entry.metadata.previousStatus} → ${entry.metadata.newStatus}`;
  }
  return entry.action;
}

export default function AdminAuditLogPage() {
  const { token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const action = searchParams.get("action") || "";
  const page = Number(searchParams.get("page")) || 1;

  const { status, data, error, refresh } = useApiResource(
    () => adminApi.getAuditLog(token, { action, page, limit: 30 }),
    [token, action, page]
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

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading eyebrow="Audit Log" title="Administrative History" size="section" />

      <div className="max-w-xs">
        <SelectField
          id="audit-log-action"
          label="Action"
          value={action}
          onChange={(e) => updateParams({ action: e.target.value })}
        >
          <option value="">All actions</option>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </SelectField>
      </div>

      <DataTable
        status={status}
        error={error}
        rows={data?.data?.items || []}
        emptyTitle="No audit log entries"
        emptyDescription={action ? "Try a different action filter." : "Sensitive admin/merchant actions will appear here as they happen."}
        onRetry={refresh}
        columns={[
          { key: "action", header: "Change", render: (r) => describeEntry(r) },
          {
            key: "entity",
            header: "Entity",
            render: (r) => `${r.entity_type}${r.actor_merchant_name ? ` · ${r.actor_merchant_name}` : ""} #${r.entity_id}`,
            mobileHidden: true,
          },
          {
            key: "reason",
            header: "Reason",
            render: (r) => r.metadata?.reason || "—",
            mobileHidden: true,
          },
          {
            key: "actor",
            header: "Admin",
            render: (r) => r.actor_name || r.actor_email || "System",
          },
          { key: "created_at", header: "When", render: (r) => formatDateTime(r.created_at) },
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
