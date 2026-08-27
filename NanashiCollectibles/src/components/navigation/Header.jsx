import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import Container from "../layout/Container.jsx";
import Button from "../ui/Button.jsx";
import MobileNav from "./MobileNav.jsx";
import { primaryNav } from "../../config/site.js";
import { useAuth } from "../../features/auth/AuthContext.js";

function AuthControls() {
  const { status, user, logout } = useAuth();

  if (status === "loading") return <div className="h-9 w-20" aria-hidden="true" />;

  if (status === "authenticated") {
    return (
      <div className="flex items-center gap-3">
        <span className="max-w-[8rem] truncate text-sm text-amber-50/60">{user.name}</span>
        <Button variant="ghost" size="md" onClick={logout}>
          Log out
        </Button>
      </div>
    );
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

const dropdownLinkClasses = ({ isActive }) =>
  [
    "block rounded-lg px-3 py-2 text-sm transition-colors duration-150 focus-ring",
    isActive ? "bg-white/5 text-amber-50" : "text-amber-50/80 hover:bg-white/5 hover:text-amber-50",
  ].join(" ");

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const toggleRef = useRef(null);

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

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-ink-950/85 backdrop-blur-md">
      <Container className="flex h-16 items-center justify-between">
        <NavLink
          to="/"
          className="rounded font-display text-lg font-semibold tracking-tight text-amber-50 focus-ring"
        >
          Nanashi<span className="text-brand-400">Collectibles</span>
        </NavLink>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
          {primaryNav.map((item) =>
            item.children ? (
              <div key={item.label} className="group relative">
                <NavLink to={item.to} className={navLinkClasses}>
                  <span className="inline-flex items-center gap-1">
                    {item.label}
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 20 20"
                      fill="none"
                      className="h-3.5 w-3.5 text-amber-50/40 transition-transform duration-150 group-hover:rotate-180 group-focus-within:rotate-180"
                    >
                      <path
                        d="M5 7.5l5 5 5-5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </NavLink>
                <div
                  className="invisible absolute left-1/2 top-full z-50 w-56 -translate-x-1/2 translate-y-1 rounded-xl border border-white/10 bg-ink-800 p-1.5 opacity-0 shadow-xl shadow-black/40 transition-all duration-150 group-hover:visible group-hover:translate-y-2 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-2 group-focus-within:opacity-100"
                >
                  {item.children.map((child) => (
                    <NavLink key={child.to} to={child.to} className={dropdownLinkClasses}>
                      {child.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            ) : (
              <NavLink key={item.to} to={item.to} className={navLinkClasses}>
                {item.label}
              </NavLink>
            )
          )}
        </nav>

        <div className="hidden items-center gap-4 md:flex">
          <AuthControls />
          <Button to="/contact" size="md">
            Get in touch
          </Button>
        </div>

        <button
          ref={toggleRef}
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-amber-50 focus-ring md:hidden"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav"
          onClick={() => setMobileOpen((open) => !open)}
        >
          <span className="relative block h-3.5 w-4.5">
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
      </Container>

      <MobileNav open={mobileOpen} onNavigate={() => setMobileOpen(false)} />
    </header>
  );
}
