import { NavLink } from "react-router-dom";
import Container from "../layout/Container.jsx";
import { primaryNav } from "../../config/site.js";
import { useAuth } from "../../features/auth/AuthContext.js";

export default function MobileNav({ open, onNavigate }) {
  const { status, user, logout } = useAuth();

  if (!open) return null;

  const flatLinks = primaryNav.flatMap((item) =>
    item.children ? [item, ...item.children] : [item]
  );

  return (
    <div className="border-b border-white/5 bg-ink-950/95 md:hidden" id="mobile-nav">
      <Container className="flex flex-col gap-1 py-4">
        {flatLinks.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              [
                "rounded-lg px-3 py-2.5 text-sm font-medium",
                isActive ? "bg-white/5 text-amber-50" : "text-amber-50/70",
              ].join(" ")
            }
          >
            {item.label}
          </NavLink>
        ))}

        {status === "authenticated" ? (
          <button
            type="button"
            onClick={() => {
              logout();
              onNavigate();
            }}
            className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-amber-50/70"
          >
            Log out ({user.name})
          </button>
        ) : status === "unauthenticated" ? (
          <NavLink
            to="/login"
            onClick={onNavigate}
            className="rounded-lg px-3 py-2.5 text-sm font-medium text-amber-50/70"
          >
            Log in
          </NavLink>
        ) : null}

        <NavLink
          to="/contact"
          onClick={onNavigate}
          className="mt-2 rounded-lg bg-brand-500 px-3 py-2.5 text-center text-sm font-medium text-white"
        >
          Get in touch
        </NavLink>
      </Container>
    </div>
  );
}
