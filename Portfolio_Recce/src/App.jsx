import { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import SiteFooter from "./components/SiteFooter";
import SiteHeader from "./components/SiteHeader";
import ContactPage from "./page/ContactPage";
import FleetPage from "./page/FleetPage";
import HomePage from "./page/HomePage";
import NotFoundPage from "./page/NotFoundPage";
import ServicesPage from "./page/ServicesPage";
import WorkPage from "./page/WorkPage";
import { featuredFilm, fleet, highlights, services } from "./page/pageData";

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const year = useMemo(() => new Date().getFullYear(), []);
  const location = useLocation();

  useEffect(() => {
    const revealItems = document.querySelectorAll(".reveal, .reveal-blur");

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const delay = entry.target.getAttribute("data-delay");
            if (delay) {
              entry.target.style.setProperty("--delay", `${delay}ms`);
            }
            entry.target.classList.add("show");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    revealItems.forEach((item) => observer.observe(item));

    return () => observer.disconnect();
  }, [location.pathname]);

  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [location.pathname]);

  return (
    <div className="min-h-screen text-slate-100 font-body">
      <SiteHeader menuOpen={menuOpen} setMenuOpen={setMenuOpen} />

      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/home" element={<Navigate to="/" replace />} />
          <Route path="/work" element={<WorkPage featuredFilm={featuredFilm} highlights={highlights} />} />
          <Route path="/fleet" element={<FleetPage fleet={fleet} />} />
          <Route path="/services" element={<ServicesPage services={services} />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      <SiteFooter year={year} />
    </div>
  );
}

export default App;
