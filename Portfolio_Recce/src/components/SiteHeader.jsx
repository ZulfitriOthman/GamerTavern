import { Link, NavLink } from "react-router-dom";
import logoImage from "../../assets/images/profile-izrat.jpg";

function SiteHeader({ menuOpen, setMenuOpen }) {
  const navLinkClass = ({ isActive }) =>
    isActive ? "text-skyaccent" : "hover:text-skyaccent";

  return (
    <header className="fixed inset-x-0 top-0 z-40 flex items-center justify-between gap-4 bg-gradient-to-b from-black/80 to-black/10 px-4 py-4 backdrop-blur md:px-10">
      <Link to="/" className="inline-flex items-center gap-3 text-slate-100">
        <img
          src={logoImage}
          alt="Recce Ops profile portrait"
          className="h-9 w-9 rounded-full border border-white/35 object-cover"
        />
        <span className="font-display text-2xl tracking-wider">Recce Ops</span>
      </Link>

      <button
        type="button"
        className="inline-flex h-11 w-11 flex-col items-center justify-center gap-1.5 rounded-lg border border-white/20 bg-slate-900/80 md:hidden"
        aria-expanded={menuOpen}
        aria-controls="mainNav"
        aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
        onClick={() => setMenuOpen((prev) => !prev)}
      >
        <span
          className={`h-0.5 w-6 bg-white transition-transform duration-200 ${
            menuOpen ? "translate-y-2 rotate-45" : ""
          }`}
        />
        <span className={`h-0.5 w-6 bg-white transition-opacity duration-200 ${menuOpen ? "opacity-0" : ""}`} />
        <span
          className={`h-0.5 w-6 bg-white transition-transform duration-200 ${
            menuOpen ? "-translate-y-2 -rotate-45" : ""
          }`}
        />
      </button>

      {menuOpen && (
        <div
          aria-hidden="true"
          className="fixed inset-x-0 top-16 bottom-0 z-30 bg-black/40 md:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <nav
        id="mainNav"
        className={`${
          menuOpen ? "flex" : "hidden"
        } absolute right-4 top-16 z-40 min-w-52 flex-col gap-3 rounded-xl border border-white/15 bg-slate-900/95 p-3 md:static md:z-auto md:flex md:min-w-0 md:flex-row md:items-center md:gap-5 md:border-0 md:bg-transparent md:p-0`}
      >
        <NavLink to="/work" className={navLinkClass} onClick={() => setMenuOpen(false)}>
          Work
        </NavLink>
        <NavLink to="/fleet" className={navLinkClass} onClick={() => setMenuOpen(false)}>
          Fleet
        </NavLink>
        <NavLink to="/services" className={navLinkClass} onClick={() => setMenuOpen(false)}>
          Services
        </NavLink>
        <NavLink
          to="/contact"
          className="rounded-full bg-gradient-to-r from-skyaccent to-cyan-200 px-4 py-2 text-sm font-semibold text-slate-950"
          onClick={() => setMenuOpen(false)}
        >
          Contact
        </NavLink>
      </nav>
    </header>
  );
}

export default SiteHeader;
