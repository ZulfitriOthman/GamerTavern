import { useEffect, useState } from "react";
import Section from "../components/layout/Section.jsx";
import Button from "../components/ui/Button.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import StatusBadge from "../components/ui/StatusBadge.jsx";
import Pagination from "../components/ui/Pagination.jsx";
import { SkeletonText } from "../components/ui/Skeleton.jsx";
import { useAuth } from "../features/auth/AuthContext.js";
import { listOrders } from "../features/orders/orderService.js";
import { formatMoney } from "../features/shop/format.js";

function OrdersSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-xl border border-white/10 p-5">
          <SkeletonText lines={2} />
        </div>
      ))}
    </div>
  );
}

export default function OrdersListPage() {
  const { token, status: authStatus } = useAuth();
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);

  function load() {
    if (authStatus !== "authenticated") return;
    setStatus("loading");
    listOrders({ token, page })
      .then((res) => {
        setData(res);
        setStatus("success");
      })
      .catch((err) => {
        setError(err.message);
        setStatus("error");
      });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus, token, page]);

  if (authStatus === "loading" || status === "loading") {
    return (
      <Section spacing="lg" containerSize="wide" className="pt-14 sm:pt-20">
        <h1 className="mb-8 font-display text-2xl font-semibold text-amber-50 sm:text-3xl">Orders</h1>
        <OrdersSkeleton />
      </Section>
    );
  }

  if (authStatus !== "authenticated") {
    return (
      <Section spacing="lg" containerSize="wide" className="pt-14 sm:pt-20">
        <ErrorState
          icon="package"
          title="Log in to view your orders"
          description="Your order history is tied to your account."
          action={<Button to="/login" state={{ from: "/orders" }}>Log in</Button>}
        />
      </Section>
    );
  }

  if (status === "error") {
    return (
      <Section spacing="lg" containerSize="wide" className="pt-14 sm:pt-20">
        <ErrorState icon="package" title="Couldn't load your orders" description={error} action={<Button onClick={load}>Retry</Button>} />
      </Section>
    );
  }

  if (data.items.length === 0) {
    return (
      <Section spacing="lg" containerSize="wide" className="pt-14 sm:pt-20">
        <h1 className="mb-8 font-display text-2xl font-semibold text-amber-50 sm:text-3xl">Orders</h1>
        <EmptyState
          title="No orders yet"
          description="Your purchases will appear here."
          action={<Button to="/shop">Browse Shop</Button>}
        />
      </Section>
    );
  }

  return (
    <Section spacing="lg" containerSize="wide" className="pb-24 pt-14 sm:pt-20">
      <h1 className="mb-8 font-display text-2xl font-semibold text-amber-50 sm:text-3xl">Orders</h1>

      <div className="flex flex-col divide-y divide-white/5 rounded-xl border border-white/10">
        {data.items.map((order) => (
          <div key={order.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-amber-50">{order.order_number}</p>
                <StatusBadge status={order.status} />
                <StatusBadge status={order.payment_status} />
              </div>
              <p className="text-xs text-amber-50/45">
                {new Date(order.placed_at || order.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                {" · "}
                {order.item_count} item{order.item_count === 1 ? "" : "s"}
                {order.merchant_count > 1 ? ` · ${order.merchant_count} merchants` : ""}
              </p>
            </div>

            <div className="flex items-center gap-4">
              <p className="font-display text-lg font-semibold text-amber-50">{formatMoney(order.grand_total)}</p>
              <Button to={`/orders/${order.id}`} variant="secondary" size="sm">
                View order
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Pagination pagination={data.pagination} onPageChange={setPage} />
    </Section>
  );
}
