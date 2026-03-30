import { useEffect, useMemo, useState } from "react";

const galleryItems = [
  {
    src: "/assets/images/work-1.jpg",
    alt: "Aerial city skyline at golden hour",
    caption: "City Tourism Campaign",
  },
  {
    src: "/assets/images/work-2.jpg",
    alt: "Luxury house roof and landscape from above",
    caption: "Real Estate Showcase",
  },
  {
    src: "/assets/images/work-3.jpg",
    alt: "Bridge inspection with drone support",
    caption: "Infrastructure Inspection",
  },
  {
    src: "/assets/images/work-4.jpg",
    alt: "Outdoor wedding venue from drone perspective",
    caption: "Event Coverage",
  },
];

const fleet = [
  {
    name: "Drone Type A",
    role: "Cinematic Production Drone",
    specs: [
      "Camera: 5.1K video / 20MP stills",
      "Flight Time: up to 40 minutes",
      "Top Speed: 68 kph",
      "Use Cases: commercials, events, tourism",
    ],
  },
  {
    name: "Drone Type B",
    role: "Inspection and Mapping Drone",
    specs: [
      "Camera: 4K video / 48MP high-res mode",
      "Flight Time: up to 46 minutes",
      "Wind Resistance: up to 43 kph",
      "Use Cases: roof checks, construction, surveys",
    ],
  },
];

const services = [
  {
    title: "Pre-Flight Planning",
    copy: "Location scouting, airspace checks, weather assessment, and mission design.",
  },
  {
    title: "Aerial Capture",
    copy: "Smooth, stable footage and high-resolution images with safe, compliant operation.",
  },
  {
    title: "Post Production",
    copy: "Color grading, shot selection, and export for social, broadcast, or internal reporting.",
  },
];

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const year = useMemo(() => new Date().getFullYear(), []);

  useEffect(() => {
    const revealItems = document.querySelectorAll(".reveal");

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
  }, []);

  useEffect(() => {
    const onEscape = (event) => {
      if (event.key === "Escape") {
        setLightboxImage(null);
      }
    };

    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, []);

  return (
    <div className="min-h-screen text-slate-100 font-body">
      <header className="fixed inset-x-0 top-0 z-40 flex items-center justify-between gap-4 bg-gradient-to-b from-black/80 to-black/10 px-4 py-4 backdrop-blur md:px-10">
        <a href="#top" className="inline-flex items-center gap-3 text-slate-100">
          <span className="grid h-9 w-9 place-content-center rounded-full bg-gradient-to-br from-skyaccent to-cyan-200 font-display text-lg tracking-wide text-slate-900">
            SO
          </span>
          <span className="font-display text-2xl tracking-wider">Skyline Ops</span>
        </a>

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
          <a href="#work" className="hover:text-skyaccent" onClick={() => setMenuOpen(false)}>
            Work
          </a>
          <a href="#fleet" className="hover:text-skyaccent" onClick={() => setMenuOpen(false)}>
            Fleet
          </a>
          <a href="#services" className="hover:text-skyaccent" onClick={() => setMenuOpen(false)}>
            Services
          </a>
          <a
            href="#contact"
            className="rounded-full bg-gradient-to-r from-skyaccent to-cyan-200 px-4 py-2 text-sm font-semibold text-slate-950"
            onClick={() => setMenuOpen(false)}
          >
            Book Flight
          </a>
        </nav>
      </header>

      <main id="top">
        <section className="relative min-h-[92vh] overflow-hidden px-4 pb-12 pt-32 md:px-10">
          <video
            className="absolute inset-0 h-full w-full object-cover opacity-35"
            autoPlay
            muted
            loop
            playsInline
            poster="/assets/images/hero-poster.jpg"
          >
            <source src="/assets/videos/hero-reel.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-[linear-gradient(130deg,rgba(10,15,22,0.88)_6%,rgba(10,15,22,0.36)_48%,rgba(10,15,22,0.85)_100%),linear-gradient(180deg,rgba(10,15,22,0)_0%,rgba(10,15,22,0.7)_80%)]" />

          <div className="relative z-10 reveal">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-skyaccent md:text-sm">
              Licensed Drone Operator
            </p>
            <h1 className="max-w-[13ch] font-display text-5xl leading-[0.95] tracking-wide md:text-8xl">
              Aerial Storytelling with Precision and Edge.
            </h1>
            <p className="mt-4 max-w-2xl text-sm text-slate-300 md:text-base">
              I fly for brands, real estate, events, inspections, and mapping missions. Every
              frame is captured with safe operations and cinematic intent.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="#contact"
                className="rounded-full bg-gradient-to-r from-skyaccent to-cyan-200 px-5 py-3 font-semibold text-slate-950"
              >
                Start a Project
              </a>
              <a
                href="#work"
                className="rounded-full border border-white/25 bg-white/10 px-5 py-3 font-semibold text-white"
              >
                Watch Highlights
              </a>
            </div>
          </div>

          <div className="relative z-10 mt-12 grid gap-4 md:mt-24 md:grid-cols-3 reveal">
            {[
              ["230+", "Completed Flights"],
              ["4K/5.1K", "Capture Quality"],
              ["100%", "Safety First Workflow"],
            ].map(([value, label]) => (
              <article key={label} className="rounded-2xl border border-white/20 bg-slate-900/65 p-4 shadow-panel">
                <h2 className="font-display text-4xl tracking-wide">{value}</h2>
                <p className="text-sm text-slate-300">{label}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="work" className="px-4 py-14 md:px-10 md:py-20">
          <div className="mb-7 reveal">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-skyaccent md:text-sm">
              Featured Work
            </p>
            <h2 className="font-display text-4xl tracking-wide md:text-6xl">Recent Missions</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {galleryItems.map((item, index) => (
              <figure
                key={item.src}
                data-delay={index * 100}
                className="reveal overflow-hidden rounded-2xl border border-white/15 bg-slate-900 shadow-panel"
              >
                <button
                  type="button"
                  className="group block w-full"
                  onClick={() => setLightboxImage(item)}
                  aria-label={`Open ${item.caption}`}
                >
                  <img
                    src={item.src}
                    alt={item.alt}
                    className="h-64 w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                </button>
                <figcaption className="px-4 py-3 text-slate-300">{item.caption}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section id="fleet" className="px-4 py-14 md:px-10 md:py-20">
          <div className="mb-7 reveal">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-skyaccent md:text-sm">
              Drone Fleet
            </p>
            <h2 className="font-display text-4xl tracking-wide md:text-6xl">
              Two Platforms, Two Mission Styles
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {fleet.map((drone, index) => (
              <article
                key={drone.name}
                data-delay={index * 120}
                className="reveal rounded-2xl border border-white/15 bg-gradient-to-br from-slate-900 to-slate-800 p-5 shadow-panel"
              >
                <h3 className="font-display text-4xl tracking-wide">{drone.name}</h3>
                <p className="mb-3 text-warmaccent">{drone.role}</p>
                <ul className="list-disc space-y-2 pl-5 text-slate-300">
                  {drone.specs.map((spec) => (
                    <li key={spec}>{spec}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section id="services" className="px-4 py-14 md:px-10 md:py-20">
          <div className="mb-7 reveal">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-skyaccent md:text-sm">
              Services
            </p>
            <h2 className="font-display text-4xl tracking-wide md:text-6xl">
              From Planning to Final Delivery
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {services.map((service, index) => (
              <article
                key={service.title}
                data-delay={index * 100}
                className="reveal rounded-2xl border border-white/15 bg-gradient-to-br from-slate-900 to-slate-800 p-5 shadow-panel"
              >
                <h3 className="mb-2 text-xl font-semibold">{service.title}</h3>
                <p className="text-slate-300">{service.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="contact" className="px-4 pb-14 md:px-10 md:pb-20">
          <div className="reveal max-w-4xl rounded-2xl border border-white/15 bg-gradient-to-br from-slate-900 to-slate-800 p-6 shadow-panel md:p-8">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-skyaccent md:text-sm">
              Contact
            </p>
            <h2 className="font-display text-4xl tracking-wide md:text-6xl">
              Let Your Next Project Take Off
            </h2>
            <p className="mt-3 text-slate-300">
              Share your location, timeline, and goals. I will reply with a flight plan and quote.
            </p>
            <div className="mt-5 flex flex-wrap gap-4 text-slate-100">
              <a href="mailto:hello@skylineops.com" className="underline decoration-skyaccent decoration-2 underline-offset-4">
                hello@skylineops.com
              </a>
              <a href="tel:+1234567890" className="underline decoration-skyaccent decoration-2 underline-offset-4">
                +1 (234) 567-890
              </a>
              <a href="#top" className="underline decoration-skyaccent decoration-2 underline-offset-4">
                Instagram / YouTube
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="px-4 pb-10 text-center text-slate-400 md:px-10">© {year} Skyline Ops. All rights reserved.</footer>

      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 grid place-content-center bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
          onClick={() => setLightboxImage(null)}
        >
          <div className="max-w-5xl" onClick={(event) => event.stopPropagation()}>
            <img
              src={lightboxImage.src}
              alt={lightboxImage.alt}
              className="max-h-[74vh] w-full rounded-xl object-contain"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-slate-200">{lightboxImage.caption}</p>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
