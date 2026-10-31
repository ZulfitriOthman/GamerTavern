import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import Container from "../layout/Container.jsx";
import Button from "../ui/Button.jsx";
import MobileNav from "./MobileNav.jsx";
import CartLink from "./CartLink.jsx";
import AccountMenu from "./AccountMenu.jsx";
import NavDropdown from "./NavDropdown.jsx";
import { primaryNav, utilityNav } from "../../config/site.js";
import { useAuth } from "../../features/auth/AuthContext.js";

function AuthControls() {
  const { status } = useAuth();

  if (status === "loading") return <div className="h-9 w-20" aria-hidden="true" />;

  if (status === "authenticated") {
    return <AccountMenu />;
  }

  return (
    <Button to="/login" variant="ghost" size="md">
      Log in
    </Button>
  );
}

// Active state is never color-alone — the after: underline gives a shape/contrast
// cue independent of hue, on top of the text-color change.
const navLinkClasses = ({ isActive }) =>
  [
    "relative inline-flex items-center rounded py-1 text-sm font-medium transition-colors duration-150 focus-ring",
    "after:absolute after:-bottom-1.5 after:left-0 after:right-0 after:h-0.5 after:rounded-full after:content-[''] after:transition-opacity after:duration-150",
    isActive
      ? "text-amber-50 after:bg-brand-400 after:opacity-100"
      : "text-amber-50/60 hover:text-amber-50 after:bg-brand-400 after:opacity-0",
  ].join(" ");

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  // Which primary-nav dropdown (by label) is open — lifted up here, not
  // local to each NavDropdown, so only one is ever open at a time and
  // hovering across an already-open one onto a sibling switches to it
  // instead of leaving both open. See NavDropdown.jsx for why this must
  // not be a naive per-item "hover sets open, click toggles" pair.
  const [openDropdown, setOpenDropdown] = useState(null);
  const toggleRef = useRef(null);
  const { status } = useAuth();

  // Escape closes the mobile menu and returns focus to the control that opened it.
  useEffect(() => {
    if (!mobileOpen) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setMobileOpen(false);
        toggleRef.current?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen]);

  // Logged-in customers already see Orders/Account in AccountMenu — the
  // "Get in touch" CTA is for prospective customers/merchants, not an
  // authenticated shopper mid-browse, so it drops out once logged in
  // (per the navbar redesign) to keep the utility zone compact.
  const showCta = status !== "authenticated";

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-ink-950/85 backdrop-blur-md">
      <Container size="xwide" className="flex h-16 items-center justify-between gap-3">
        <NavLink
          to="/"
          className="shrink-0 rounded font-display text-lg font-semibold tracking-tight text-amber-50 focus-ring"
        >
          Nanashi<span className="text-brand-400">Collectibles</span>
        </NavLink>

        {/* Primary destinations — four, not nine. TCG/RVS Esports live inside
            "Explore"; Services keeps its existing children. */}
        <nav className="hidden items-center gap-4 lg:flex xl:gap-8" aria-label="Primary">
          {primaryNav.map((item) =>
            item.children ? (
              <NavDropdown
                key={item.label}
                label={item.label}
                to={item.to}
                items={item.children}
                isOpen={openDropdown === item.label}
                anyOpen={openDropdown !== null}
                onOpen={() => setOpenDropdown(item.label)}
                onClose={() => setOpenDropdown((prev) => (prev === item.label ? null : prev))}
              />
            ) : (
              <NavLink key={item.to} to={item.to} className={navLinkClasses}>
                {item.label}
              </NavLink>
            )
          )}
        </nav>

        {/* Utility zone — visually secondary to primary nav: Merchant Portal
            is muted/smaller and set off by a divider, distinguishing "browse
            the store" from "manage your store." */}
        <div className="hidden items-center gap-2 lg:flex xl:gap-4">
          {utilityNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  "rounded py-1 text-xs font-medium transition-colors duration-150 focus-ring sm:text-sm",
                  isActive ? "text-amber-50/80" : "text-amber-50/45 hover:text-amber-50/75",
                ].join(" ")
              }
            >
              {item.label}
            </NavLink>
          ))}

          <span className="h-4 w-px bg-white/10" aria-hidden="true" />

          <AuthControls />
          <CartLink />
          {showCta ? (
            <Button to="/contact" size="sm">
              Get in touch
            </Button>
          ) : null}
        </div>

        {/* Tablet/mobile: logo, cart, menu button only — everything else
            lives in the drawer below. */}
        <div className="flex items-center gap-2 lg:hidden">
          <CartLink />

          <button
            ref={toggleRef}
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-amber-50 focus-ring"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            onClick={() => setMobileOpen((open) => !open)}
          >
            <span className="relative block h-3.5 w-4">
              <span
                className={[
                  "absolute inset-x-0 top-0 h-0.5 bg-current transition-transform duration-150",
                  mobileOpen ? "translate-y-[7px] rotate-45" : "",
                ].join(" ")}
              />
              <span
                className={[
                  "absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-current transition-opacity duration-150",
                  mobileOpen ? "opacity-0" : "opacity-100",
                ].join(" ")}
              />
              <span
                className={[
                  "absolute inset-x-0 bottom-0 h-0.5 bg-current transition-transform duration-150",
                  mobileOpen ? "-translate-y-[7px] -rotate-45" : "",
                ].join(" ")}
              />
            </span>
          </button>
        </div>
      </Container>

      <MobileNav open={mobileOpen} onNavigate={() => setMobileOpen(false)} />
    </header>
  );
}
