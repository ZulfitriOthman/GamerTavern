import { Link, NavLink } from "react-router-dom";

function SiteHeader({ menuOpen, setMenuOpen }) {
  const navLinkClass = ({ isActive }) =>
    isActive ? "text-skyaccent" : "hover:text-skyaccent";

  return (
    <header className="fixed inset-x-0 top-0 z-40 flex items-center justify-between gap-4 bg-gradient-to-b from-black/80 to-black/10 px-4 py-4 backdrop-blur md:px-10">
      <Link to="/" className="inline-flex items-center gap-3 text-slate-100">
        <span className="grid h-9 w-9 place-content-center rounded-full bg-gradient-to-br from-skyaccent to-cyan-200 font-display text-lg tracking-wide text-slate-900">
          SO
        </span>
        <span className="font-display text-2xl tracking-wider">Skyline Ops</span>
      </Link>

      <button
        type="button"
        className="inline-flex h-11 w-11 flex-col items-center justify-center rounded-lg border border-white/20 bg-slate-900/80 md:hidden"
        aria-expanded={menuOpen}
        aria-controls="mainNav"
        onClick={() => setMenuOpen((prev) => !prev)}
      >
        <span className="mb-1 h-0.5 w-6 bg-white" />
        <span className="mb-1 h-0.5 w-6 bg-white" />
        <span className="h-0.5 w-6 bg-white" />
      </button>

      <nav
        id="mainNav"
        className={`${
          menuOpen ? "flex" : "hidden"
        } absolute right-4 top-16 min-w-52 flex-col gap-3 rounded-xl border border-white/15 bg-slate-900/95 p-3 md:static md:flex md:min-w-0 md:flex-row md:items-center md:gap-5 md:border-0 md:bg-transparent md:p-0`}
      >
        <NavLink to="/work" className={navLinkClass}>
          Work
        </NavLink>
        <NavLink to="/fleet" className={navLinkClass}>
          Fleet
        </NavLink>
        <NavLink to="/services" className={navLinkClass}>
          Services
        </NavLink>
        <NavLink
          to="/contact"
          className="rounded-full bg-gradient-to-r from-skyaccent to-cyan-200 px-4 py-2 text-sm font-semibold text-slate-950"
        >
          Book Flight
        </NavLink>
      </nav>
    </header>
  );
}

export default SiteHeader;
