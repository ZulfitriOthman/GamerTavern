import SectionHeading from "../../components/ui/SectionHeading.jsx";
import Card from "../../components/ui/Card.jsx";
import StatusBadge from "../../components/ui/StatusBadge.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import { SkeletonText } from "../../components/ui/Skeleton.jsx";
import KpiCard from "../../components/merchant/KpiCard.jsx";
import RevenueTrendChart from "../../components/merchant/RevenueTrendChart.jsx";
import { useMerchantAuth } from "../../features/merchant/MerchantAuthContext.js";
import { useApiResource } from "../../features/merchant/useApiResource.js";
import * as merchantApi from "../../features/merchant/merchantApi.js";
import { formatMoney, formatDate } from "../../features/merchant/format.js";

export default function MerchantDashboardPage() {
  const { token, activeMerchant } = useMerchantAuth();
  const { status, data, error, refresh } = useApiResource(
    () => merchantApi.getDashboard(token, { merchantId: activeMerchant?.merchantId }),
    [token, activeMerchant?.merchantId]
  );

  const dashboard = data?.data;

  return (
    <div className="flex flex-col gap-8">
      <SectionHeading
        eyebrow="Overview"
        title={`Welcome back, ${activeMerchant?.displayName || "there"}`}
        description="Real-time snapshot of your store's performance."
        size="section"
      />

      {status === "loading" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Card key={i}>
              <SkeletonText lines={2} />
            </Card>
          ))}
        </div>
      ) : status === "error" ? (
        <EmptyState title="Couldn't load your dashboard" description={error} action={<button onClick={refresh} className="text-sm text-brand-400 hover:text-brand-300">Try again</button>} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Today's sales" value={formatMoney(dashboard.todaySales)} />
            <KpiCard label="Total revenue" value={formatMoney(dashboard.totalSales)} />
            <KpiCard label="Orders today" value={dashboard.ordersToday} />
            <KpiCard label="Pending orders" value={dashboard.pendingOrders} to="/merchant/orders?status=PROCESSING" />
            <KpiCard label="Active products" value={dashboard.products} to="/merchant/products" />
            <KpiCard label="Low stock" value={dashboard.lowStockProducts} tone={dashboard.lowStockProducts > 0 ? "gold" : "default"} to="/merchant/inventory?filter=low_stock" />
            <KpiCard label="Out of stock" value={dashboard.outOfStockProducts} tone={dashboard.outOfStockProducts > 0 ? "danger" : "default"} to="/merchant/inventory?filter=out_of_stock" />
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <Card variant="data">
              <h2 className="font-display text-base font-semibold text-amber-50">Revenue trend</h2>
              <p className="mt-1 text-xs text-amber-50/45">Last 14 days, net of commission.</p>
              <div className="mt-4">
                <RevenueTrendChart data={dashboard.revenueTrend} />
              </div>
            </Card>

            <Card variant="data">
              <h2 className="font-display text-base font-semibold text-amber-50">Top selling products</h2>
              {dashboard.topSellingProducts?.length ? (
                <ul className="mt-4 flex flex-col gap-3">
                  {dashboard.topSellingProducts.map((p) => (
                    <li key={p.product_id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate text-amber-50/80">{p.name}</span>
                      <span className="shrink-0 text-amber-50/45">{p.units_sold} sold</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState className="mt-4" title="No sales yet" description="Top products appear once orders come in." />
              )}
            </Card>
          </div>

          <Card variant="data">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-amber-50">Recent orders</h2>
              <a href="/merchant/orders" className="text-sm text-brand-400 hover:text-brand-300">
                View all
              </a>
            </div>
            {dashboard.recentOrders?.length ? (
              <div className="mt-4 flex flex-col gap-2">
                {dashboard.recentOrders.map((o) => (
                  <div key={o.id} className="flex items-center justify-between gap-3 border-b border-white/5 py-2.5 text-sm last:border-0">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-amber-50/85">{o.merchant_order_number}</p>
                      <p className="text-xs text-amber-50/45">{formatDate(o.created_at)} · Order {o.order_number}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-amber-50/70">{formatMoney(o.merchant_net_amount)}</span>
                      <StatusBadge status={o.status} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState className="mt-4" title="No orders yet" description="Orders will appear here as customers check out." />
            )}
          </Card>
        </>
      )}
    </div>
  );
}
