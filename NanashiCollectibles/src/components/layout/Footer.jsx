import { Link } from "react-router-dom";
import Container from "./Container.jsx";
import { footerNav, site } from "../../config/site.js";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/5 bg-ink-950">
      <Container className="grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-6">
        <div className="lg:col-span-2">
          <Link to="/" className="font-display text-lg font-semibold text-amber-50">
            Nanashi<span className="text-brand-400">Collectibles</span>
          </Link>
          <p className="mt-3 max-w-xs text-sm text-amber-50/60">{site.description}</p>
        </div>

        {footerNav.map((column) => (
          <div key={column.heading}>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-50/40">
              {column.heading}
            </h3>
            <ul className="mt-4 flex flex-col gap-2.5">
              {column.links.map((link) => (
                <li key={link.label}>
                  <Link to={link.to} className="text-sm text-amber-50/70 hover:text-amber-50">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Container>

      <div className="border-t border-white/5 py-6">
        <Container className="text-xs text-amber-50/40">
          © {year} {site.name}. All rights reserved.
        </Container>
      </div>
    </footer>
  );
}
