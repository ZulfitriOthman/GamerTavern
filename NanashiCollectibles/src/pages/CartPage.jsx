import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Section from "../components/layout/Section.jsx";
import Button from "../components/ui/Button.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import Modal from "../components/ui/Modal.jsx";
import { Skeleton, SkeletonText } from "../components/ui/Skeleton.jsx";
import { useToast } from "../components/ui/ToastContext.js";
import CartItemRow from "../components/cart/CartItemRow.jsx";
import OrderSummary from "../components/cart/OrderSummary.jsx";
import { useCart } from "../features/cart/CartContext.js";
import { groupItemsByMerchant } from "../features/cart/groupByMerchant.js";
import { formatMoney } from "../features/shop/format.js";

function CartSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-6">
        {[0, 1].map((i) => (
          <div key={i} className="flex gap-4 rounded-xl border border-white/10 p-5">
            <Skeleton className="h-24 w-24 shrink-0 rounded-lg" />
            <div className="flex-1">
              <SkeletonText lines={3} />
            </div>
          </div>
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

export default function CartPage() {
  const cart = useCart();
  const { push } = useToast();
  const navigate = useNavigate();
  const [busyItemId, setBusyItemId] = useState(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  async function handleQuantityChange(itemId, quantity) {
    setBusyItemId(itemId);
    try {
      await cart.updateItem(itemId, quantity);
    } catch (err) {
      push({ tone: "error", message: err.message });
    } finally {
      setBusyItemId(null);
    }
  }

  async function handleRemove(itemId) {
    setBusyItemId(itemId);
    try {
      await cart.removeItem(itemId);
      push({ tone: "info", message: "Item removed from cart." });
    } catch (err) {
      push({ tone: "error", message: err.message });
    } finally {
      setBusyItemId(null);
    }
  }

  async function handleClearConfirm() {
    setClearing(true);
    try {
      await cart.clear();
      push({ tone: "info", message: "Cart cleared." });
      setClearOpen(false);
    } catch (err) {
      push({ tone: "error", message: err.message });
    } finally {
      setClearing(false);
    }
  }

  if (cart.status === "loading") {
    return (
      <Section spacing="lg" containerSize="xwide" className="pb-24 pt-14 sm:pt-20">
        <h1 className="mb-8 font-display text-2xl font-semibold text-amber-50 sm:text-3xl">Cart</h1>
        <CartSkeleton />
      </Section>
    );
  }

  if (cart.status === "error") {
    return (
      <Section spacing="lg" containerSize="wide" className="pt-14 sm:pt-20">
        <ErrorState
          icon="cart"
          title="Couldn't load your cart"
          description={cart.error || "Something went wrong. Please try again."}
          action={<Button onClick={cart.refresh}>Retry</Button>}
        />
      </Section>
    );
  }

  if (cart.items.length === 0) {
    return (
      <Section spacing="lg" containerSize="wide" className="pt-14 sm:pt-20">
        <h1 className="mb-8 font-display text-2xl font-semibold text-amber-50 sm:text-3xl">Cart</h1>
        <EmptyState
          title="Your cart is empty"
          description="Discover trading cards, collectibles and more."
          action={<Button to="/shop">Continue Shopping</Button>}
        />
      </Section>
    );
  }

  const groups = groupItemsByMerchant(cart.items);
  const hasIssue = cart.items.some(
    (item) => item.product_status !== "active" || item.available_stock <= 0 || item.quantity > item.available_stock
  );

  return (
    <Section spacing="lg" containerSize="xwide" className="pb-32 pt-14 sm:pb-24 sm:pt-20">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-amber-50 sm:text-3xl">Cart</h1>
        <button
          type="button"
          onClick={() => setClearOpen(true)}
          className="rounded text-sm font-medium text-amber-50/50 transition-colors duration-150 hover:text-danger-400 focus-ring"
        >
          Clear cart
        </button>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="flex min-w-0 flex-col gap-8">
          {groups.map((group) => (
            <div key={group.key}>
              <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-amber-50/40">{group.label}</h2>
              <ul className="divide-y divide-white/5 border-b border-white/5">
                {group.items.map((item) => (
                  <CartItemRow
                    key={item.id}
                    item={item}
                    busy={busyItemId === item.id}
                    onQuantityChange={handleQuantityChange}
                    onRemove={handleRemove}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="min-w-0">
          <OrderSummary itemCount={cart.itemCount} subtotal={cart.subtotal} total={cart.subtotal} sticky>
            {hasIssue ? (
              <p className="text-xs text-danger-400">Your cart has changed — update the highlighted item(s) before checking out.</p>
            ) : null}
            <Button size="lg" className="hidden w-full lg:inline-flex" disabled={hasIssue} onClick={() => navigate("/checkout")}>
              Proceed to Checkout
            </Button>
          </OrderSummary>
        </div>
      </div>

      {/* Mobile sticky checkout bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-ink-950/95 p-4 backdrop-blur-md lg:hidden">
        <Button
          size="lg"
          className="w-full"
          disabled={hasIssue}
          onClick={() => navigate("/checkout")}
        >
          Checkout · {formatMoney(cart.subtotal)}
        </Button>
      </div>

      <Modal
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        title="Clear cart?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setClearOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" isLoading={clearing} onClick={handleClearConfirm}>
              Clear cart
            </Button>
          </>
        }
      >
        <p className="text-sm text-amber-50/70">This removes every item from your cart. This can't be undone.</p>
      </Modal>
    </Section>
  );
}
