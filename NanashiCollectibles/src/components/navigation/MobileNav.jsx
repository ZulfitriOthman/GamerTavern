import { NavLink } from "react-router-dom";
import Container from "../layout/Container.jsx";
import Button from "../ui/Button.jsx";
import { primaryNav } from "../../config/site.js";
import { useAuth } from "../../features/auth/AuthContext.js";

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

// Always mounted (toggled via the hidden attribute) rather than conditionally
// rendered — this keeps aria-controls pointing at a real element at all times, and
// `display:none` already removes every descendant from the tab order for free when
// closed, so no manual tabIndex bookkeeping is needed either state.
export default function MobileNav({ open, onNavigate }) {
  const { status, user, logout } = useAuth();

  return (
    <div
      id="mobile-nav"
      className={[
        "overflow-hidden border-b border-white/5 bg-ink-950/95 md:hidden",
        open ? "mobile-nav-enter" : "hidden",
      ].join(" ")}
    >
      <Container className="flex flex-col gap-1 py-4">
        <nav aria-label="Mobile" className="flex flex-col gap-1">
          {primaryNav.map((item) => (
            <div key={item.to}>
              <NavLink to={item.to} onClick={onNavigate} className={linkClasses}>
                {item.label}
              </NavLink>
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
          ))}
        </nav>

        <div className="mt-3 flex flex-col gap-2 border-t border-white/5 pt-3">
          {status === "authenticated" ? (
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
          ) : status === "unauthenticated" ? (
            <NavLink to="/login" onClick={onNavigate} className={linkClasses}>
              Log in
            </NavLink>
          ) : null}

          <Button to="/contact" onClick={onNavigate}>
            Get in touch
          </Button>
        </div>
      </Container>
    </div>
  );
}
