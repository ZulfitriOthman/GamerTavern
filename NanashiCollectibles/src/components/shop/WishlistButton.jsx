import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../ui/Icon.jsx";
import { useWishlist } from "../../features/shop/WishlistContext.js";
import { useToast } from "../ui/ToastContext.js";

// Two sizes only: "sm" for the product card overlay, "md" for the product
// detail page's own action row — both reuse the same toggle/optimistic-state
// logic from WishlistContext rather than each having their own.
const SIZE = {
  sm: "h-8 w-8",
  md: "h-11 w-11",
};

export default function WishlistButton({ productId, size = "sm", className = "" }) {
  const { isWishlisted, toggle, isAuthenticated } = useWishlist();
  const { push } = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const wishlisted = isWishlisted(productId);

  async function handleClick(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!isAuthenticated) {
      navigate("/login", { state: { from: window.location.pathname } });
      return;
    }
    setBusy(true);
    try {
      await toggle(productId);
    } catch (err) {
      push({ tone: "danger", message: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      aria-pressed={wishlisted}
      aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
      className={[
        "flex shrink-0 items-center justify-center rounded-full border transition-colors duration-150 focus-ring disabled:opacity-60",
        SIZE[size],
        wishlisted
          ? "border-danger-500/40 bg-danger-500/10 text-danger-400"
          : "border-white/10 bg-ink-900/70 text-amber-50/60 hover:border-white/20 hover:text-amber-50",
        className,
      ].join(" ")}
    >
      <Icon name="heart" filled={wishlisted} className={size === "sm" ? "h-4 w-4" : "h-5 w-5"} />
    </button>
  );
}
