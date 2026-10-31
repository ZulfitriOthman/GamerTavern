import SectionHeading from "../../components/ui/SectionHeading.jsx";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import StatusBadge from "../../components/ui/StatusBadge.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import { SkeletonText } from "../../components/ui/Skeleton.jsx";
import KpiCard from "../../components/merchant/KpiCard.jsx";
import { useAuth } from "../../features/auth/AuthContext.js";
import { useApiResource } from "../../features/merchant/useApiResource.js";
import * as adminApi from "../../features/admin/adminApi.js";
import { formatDate } from "../../features/merchant/format.js";

export default function AdminDashboardPage() {
  const { token, user } = useAuth();

  const stats = useApiResource(() => adminApi.getMerchantStats(token), [token]);
  const dashboardStats = useApiResource(() => adminApi.getDashboardStats(token), [token]);
  const pending = useApiResource(
    () => adminApi.getMerchants(token, { status: "PENDING", limit: 10 }),
    [token]
  );

  const counts = stats.data?.data;
  const platformCounts = dashboardStats.data?.data;
  const pendingMerchants = pending.data?.data?.items || [];

  return (
    <div className="flex flex-col gap-8">
      <SectionHeading
        eyebrow="Nanashi Admin"
        title={`Welcome, ${user?.name || "Admin"}`}
        description="Review and manage merchant applications."
        size="section"
      />

      {stats.status === "loading" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Card key={i}>
              <SkeletonText lines={2} />
            </Card>
          ))}
        </div>
      ) : stats.status === "error" ? (
        <EmptyState
          title="Couldn't load merchant stats"
          description={stats.error}
          action={
            <Button variant="secondary" size="sm" onClick={stats.refresh}>
              Try again
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Total Merchants" value={counts.total} to="/admin/merchants" />
          <KpiCard
            label="Pending"
            value={counts.pending}
            tone={counts.pending > 0 ? "gold" : "default"}
            to="/admin/merchants?status=PENDING"
          />
          <KpiCard label="Active" value={counts.active} to="/admin/merchants?status=ACTIVE" />
          <KpiCard
            label="Rejected"
            value={counts.rejected}
            tone={counts.rejected > 0 ? "danger" : "default"}
            to="/admin/merchants?status=REJECTED"
          />
        </div>
      )}

      {dashboardStats.status === "loading" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Card key={i}>
              <SkeletonText lines={2} />
            </Card>
          ))}
        </div>
      ) : dashboardStats.status === "error" ? (
        <EmptyState
          title="Couldn't load platform stats"
          description={dashboardStats.error}
          action={
            <Button variant="secondary" size="sm" onClick={dashboardStats.refresh}>
              Try again
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Suspended"
            value={platformCounts.merchants.suspended}
            tone={platformCounts.merchants.suspended > 0 ? "gold" : "default"}
            to="/admin/merchants?status=SUSPENDED"
          />
          <KpiCard
            label="Banned"
            value={platformCounts.merchants.banned}
            tone={platformCounts.merchants.banned > 0 ? "danger" : "default"}
            to="/admin/merchants?status=BANNED"
          />
          <KpiCard label="Orders Today" value={platformCounts.ordersToday} />
          <KpiCard label="Registered Users" value={platformCounts.registeredUsers} />
        </div>
      )}

      <Card variant="data">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-amber-50">Merchant Applications</h2>
            <p className="mt-1 text-xs text-amber-50/45">
              {pending.status === "success" ? `${pendingMerchants.length} pending application${pendingMerchants.length === 1 ? "" : "s"}` : "Loading…"}
            </p>
          </div>
          <Button to="/admin/merchants?status=PENDING" variant="secondary" size="sm">
            View all
          </Button>
        </div>

        <div className="mt-4">
          {pending.status === "loading" ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="rounded-xl border border-white/10 bg-ink-800/60 p-4">
                  <SkeletonText lines={2} />
                </div>
              ))}
            </div>
          ) : pending.status === "error" ? (
            <EmptyState
              title="Couldn't load pending merchants"
              description={pending.error}
              action={
                <Button variant="secondary" size="sm" onClick={pending.refresh}>
                  Try again
                </Button>
              }
            />
          ) : pendingMerchants.length === 0 ? (
            <EmptyState title="No pending applications" description="New merchant registrations will appear here for review." />
          ) : (
            <div className="flex flex-col gap-3">
              {pendingMerchants.map((m) => (
                <div key={m.id} className="flex flex-col gap-3 rounded-xl border border-white/10 bg-ink-800/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-amber-50/90">{m.business_name}</p>
                    <p className="mt-0.5 text-xs text-amber-50/50">
                      Contact: {m.contact_person || "—"} · Category: {m.business_category || "—"}
                    </p>
                    <p className="mt-0.5 text-xs text-amber-50/40">Registered: {formatDate(m.created_at)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <StatusBadge status={m.status} />
                    <Button to={`/admin/merchants/${m.id}`} size="sm">
                      Review
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
