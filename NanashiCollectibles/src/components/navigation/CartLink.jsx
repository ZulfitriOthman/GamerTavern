import { NavLink } from "react-router-dom";
import Icon from "../ui/Icon.jsx";
import { useCart } from "../../features/cart/CartContext.js";

// Always visible (not hidden behind the mobile hamburger) — a cart badge
// a shopper can't see without opening the menu defeats its own purpose.
// itemCount comes straight from CartProvider, so it updates the instant
// an add/remove/quantity-change/clear/login-merge resolves anywhere in
// the app — no local/duplicated count state here.
export default function CartLink({ className = "" }) {
  const { itemCount } = useCart();

  return (
    <NavLink
      to="/cart"
      aria-label={itemCount > 0 ? `Cart, ${itemCount} item${itemCount === 1 ? "" : "s"}` : "Cart"}
      className={({ isActive }) =>
        [
          "relative flex h-10 w-10 items-center justify-center rounded-lg text-amber-50/80 transition-colors duration-150 hover:text-amber-50 focus-ring",
          isActive ? "text-amber-50" : "",
          className,
        ].join(" ")
      }
    >
      <Icon name="cart" className="h-5 w-5" />
      {itemCount > 0 ? (
        <span
          className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-semibold leading-none text-white"
          aria-hidden="true"
        >
          {itemCount > 99 ? "99+" : itemCount}
        </span>
      ) : null}
    </NavLink>
  );
}
