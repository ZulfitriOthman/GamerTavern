import { NavLink } from "react-router-dom";
import Container from "../layout/Container.jsx";
import Button from "../ui/Button.jsx";
import { primaryNav, utilityNav } from "../../config/site.js";
import { useAuth } from "../../features/auth/AuthContext.js";
import { useCart } from "../../features/cart/CartContext.js";

const linkClasses = ({ isActive }) =>
  [
    "block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150 focus-ring",
    isActive ? "bg-white/5 text-amber-50" : "text-amber-50/70 hover:bg-white/5 hover:text-amber-50",
  ].join(" ");

const childLinkClasses = ({ isActive }) =>
  [
    "block rounded-lg py-2 pl-3 pr-3 text-sm transition-colors duration-150 focus-ring",
    isActive ? "text-amber-50" : "text-amber-50/60 hover:text-amber-50",
  ].join(" ");

// A dropdown-style parent (e.g. "Explore") with no landing page of its own
// renders as a plain heading — never a dead/unstyled link — with its
// children indented beneath it, same visual treatment as "Services".
function TopLevelItem({ item, onNavigate }) {
  return (
    <div>
      {item.to ? (
        <NavLink to={item.to} onClick={onNavigate} className={linkClasses}>
          {item.label}
        </NavLink>
      ) : (
        <p className="px-3 py-2.5 text-sm font-medium text-amber-50/70">{item.label}</p>
      )}
      {item.children ? (
        <div className="ml-3 mt-1 flex flex-col gap-0.5 border-l border-white/10 pl-2">
          {item.children.map((child) => (
            <NavLink key={child.to} to={child.to} onClick={onNavigate} className={childLinkClasses}>
              {child.label}
            </NavLink>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// Always mounted (toggled via the hidden attribute) rather than conditionally
// rendered — this keeps aria-controls pointing at a real element at all times, and
// `display:none` already removes every descendant from the tab order for free when
// closed, so no manual tabIndex bookkeeping is needed either state.
export default function MobileNav({ open, onNavigate }) {
  const { status, user, logout } = useAuth();
  const { itemCount } = useCart();

  return (
    <div
      id="mobile-nav"
      className={[
        "overflow-hidden border-b border-white/5 bg-ink-950/95 lg:hidden",
        open ? "mobile-nav-enter" : "hidden",
      ].join(" ")}
    >
      <Container size="xwide" className="flex flex-col gap-1 py-4">
        <nav aria-label="Mobile" className="flex flex-col gap-1">
          <NavLink to="/cart" onClick={onNavigate} className={linkClasses}>
            <span className="flex items-center justify-between">
              Cart
              {itemCount > 0 ? (
                <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-brand-500 px-1.5 text-[11px] font-semibold text-white">
                  {itemCount > 99 ? "99+" : itemCount}
                </span>
              ) : null}
            </span>
          </NavLink>
          {primaryNav.map((item) => (
            <TopLevelItem key={item.label} item={item} onNavigate={onNavigate} />
          ))}
        </nav>

        <div className="mt-3 flex flex-col gap-1 border-t border-white/5 pt-3">
          {utilityNav.map((item) => (
            <NavLink key={item.to} to={item.to} onClick={onNavigate} className={linkClasses}>
              {item.label}
            </NavLink>
          ))}

          {status === "authenticated" ? (
            <>
              <NavLink to="/orders" onClick={onNavigate} className={linkClasses}>
                Orders
              </NavLink>
              <button
                type="button"
                onClick={() => {
                  logout();
                  onNavigate();
                }}
                className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-amber-50/70 transition-colors duration-150 hover:text-amber-50 focus-ring"
              >
                Log out ({user.name})
              </button>
            </>
          ) : status === "unauthenticated" ? (
            <NavLink to="/login" onClick={onNavigate} className={linkClasses}>
              Log in
            </NavLink>
          ) : null}
        </div>

        {status !== "authenticated" ? (
          <div className="mt-2 flex flex-col gap-2">
            <Button to="/contact" onClick={onNavigate}>
              Get in touch
            </Button>
          </div>
        ) : null}
      </Container>
    </div>
  );
}
