import { useEffect, useMemo, useState } from "react";
import { TbDrone } from "react-icons/tb";
import { FaCheckCircle, FaInstagram, FaYoutube } from "react-icons/fa";
import { MdOutlineHighQuality } from "react-icons/md";
import { AiOutlineSafety } from "react-icons/ai";

const galleryItems = [
  {
    src: "/assets/Featured Work/Drone-Photography-for-Beginners-1.jpg",
    alt: "Aerial city skyline at golden hour",
    caption: "City Tourism Campaign",
  },
  {
    src: "/assets/Featured Work/Drone-Photography-for-Beginners-2.jpg",
    alt: "Luxury house roof and landscape from above",
    caption: "Real Estate Showcase",
  },
  {
    src: "/assets/Featured Work/Drone-Photography-for-Beginners-4.jpg",
    alt: "Bridge inspection with drone support",
    caption: "Infrastructure Inspection",
  },
  {
    src: "/assets/Featured Work/Drone-Photography-for-Beginners-8.jpg",
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
          <TbDrone className="w-7 h-7 text-white"/>
          {/* <span className="font-display text-2xl tracking-wider">Skyline Ops</span> */}
          <button
            className="
              group relative cursor-pointer bg-transparent border-none p-0 m-0 text-left
              text-transparent
              [-webkit-text-stroke:1px_rgba(255,255,255,1)]
            "
          >
            {/* Base text */}
            <span className="block max-w-[13ch] font-display text-2xl leading-[0.95] tracking-wider md:text-3xl md:mt-1">
              Skyline Ops
            </span>

            {/* Hover reveal */}
            <span
              className="
                absolute inset-0
                text-[#27d2ff]
                transition-all duration-700 ease-out

                [clip-path:inset(0_100%_0_0)]
                group-hover:[clip-path:inset(0_0%_0_0)]

                [-webkit-text-stroke:1px_#27d2ff]

                block max-w-[13ch] font-display text-2xl leading-[0.95] tracking-wider md:text-3xl md:mt-1
              "
            >
              Skyline Ops
            </span>
          </button>
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
          } absolute right-4 top-16 min-w-52 flex-col gap-3 rounded-xl border border-white/15 bg-slate-900/95 p-3 
            md:static md:flex md:min-w-0 md:flex-row md:items-center md:gap-5 md:border-0 md:bg-transparent md:p-0
          `}
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
        </nav>

        <a
            href="#contact"
            className="rounded-full bg-gradient-to-r from-skyaccent to-cyan-200 px-4 py-2 text-sm font-semibold text-slate-950"
            onClick={() => setMenuOpen(false)}
          >
            Book Flight
        </a>
      </header>

      <main id="top">
        <div className="bg-[#0a0f16] text-white font-body overflow-x-hidden">
      
          {/* HERO */}
          <section className="relative min-h-screen flex flex-col justify-center px-6 md:px-16">

            {/* Video */}
            <video
              className="absolute inset-0 w-full h-full object-cover opacity-40"
              autoPlay
              muted
              loop
              playsInline
            >
              <source src="/assets/Featured Work/vecteezy_drone-flying.mp4" />
            </video>

            {/* Depth Layers */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(39,210,255,0.08),transparent)]" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/40 to-black/90" />

            {/* Scan Effect */}
            <div className="pointer-events-none absolute inset-0">
              <div className="scan-line" />
            </div>

            {/* CONTENT */}
            <div className="relative z-10 max-w-4xl reveal my-20">
              <p className="text-sky-400 uppercase text-xs md:text-sm tracking-widest mb-2">
                Licensed Drone Operator
              </p>

              <h1 className="text-5xl md:text-7xl font-bold leading-tight max-w-[14ch]">
                Aerial Storytelling with Precision & Edge
              </h1>

              <p className="mt-4 text-slate-300 max-w-xl">
                Cinematic drone footage for brands, real estate, and events —
                executed with precision and safety.
              </p>

              <div className="mt-6 flex gap-4">
                <button className="btn-primary">Start Project</button>
                <button className="btn-outline">View Work</button>
              </div>
            </div>

            {/* STATS */}
            <div className="relative z-10 mt-20 grid md:grid-cols-3 gap-6 reveal">
              {[
                {
                  value: "230+",
                  label: "Completed Flights",
                  icon: (
                    <div className="relative">
                      <TbDrone className="text-5xl"/>
                      <FaCheckCircle className="absolute left-10 bottom-0.5 text-xl" />
                    </div>
                  ),
                },
                {
                  value: "4K / 5.1K",
                  label: "Capture Quality",
                  icon: <MdOutlineHighQuality className="text-6xl"/>,
                },
                {
                  value: "100%",
                  label: "Safety Workflow",
                  icon: <AiOutlineSafety className="text-5xl"/>,
                },
              ].map((item) => (
                <div key={item.label} className="stat-card group">
                  
                  {/* Glow */}
                  <div className="stat-glow" />

                  <div className="relative z-10 flex flex-row gap-10">
                    <div className="icon-box">{item.icon}</div>

                    <div>
                      <h2 className="text-3xl font-bold">{item.value}</h2>
                      <p className="text-xs uppercase tracking-widest text-slate-400">
                        {item.label}
                      </p>
                    </div>
                  </div>

                  {/* Bottom line */}
                  <div className="stat-line" />
                </div>
              ))}
            </div>
          </section>

          {/* GALLERY */}
          <section id="work" className="px-6 md:px-16 py-20">
            <div className="mb-7 reveal">
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-skyaccent md:text-sm">
                Featured Work
              </p>
              <h2 className="font-display text-4xl tracking-wide md:text-6xl">Recent Missions</h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {galleryItems.map((item) => (
                <div
                  key={item.src}
                  className="group relative overflow-hidden rounded-xl cursor-pointer"
                  onClick={() => setLightboxImage(item)}
                >
                  <img
                    src={item.src}
                    className="w-full h-64 object-cover transition duration-500 group-hover:scale-110"
                  />

                  {/* Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition" />

                  <p className="absolute bottom-4 left-4 text-white translate-y-4 group-hover:translate-y-0 transition">
                    {item.caption}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* LIGHTBOX */}
          {lightboxImage && (
            <div
              className="fixed inset-0 bg-black/90 flex items-center justify-center z-50"
              onClick={() => setLightboxImage(null)}
            >
              <img
                src={lightboxImage.src}
                className="max-h-[80vh] rounded-lg"
              />
            </div>
          )}
        </div>

        <section id="fleet" className="px-4 py-20 md:px-10">
          <div className="mb-12 reveal">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-skyaccent">
              Drone Fleet
            </p>
            <h2 className="font-display text-4xl md:text-6xl tracking-wide">
              Flight Systems
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {fleet.map((drone, index) => (
              <article
                key={drone.name}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-black/60 p-6 backdrop-blur-xl transition hover:-translate-y-2 hover:shadow-[0_30px_80px_rgba(0,0,0,0.7)]"
              >
                {/* Glow */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(39,210,255,0.25),transparent_60%)]" />
                </div>

                {/* Header */}
                <div className="relative z-10 mb-5 flex items-center gap-3">
                  <TbDrone className="text-skyaccent text-2xl" />
                  
                  <h3 className="font-display text-xl md:text-3xl tracking-wide">
                    {drone.name}
                  </h3>
                </div>

                <p className="relative z-10 text-skyaccent/80 text-sm md:text-xl mb-5">
                  {drone.role}
                </p>

                {/* Specs as chips */}
                <div className="relative z-10 flex flex-wrap gap-2">
                  {drone.specs.map((spec) => (
                    <span
                      key={spec}
                      className="text-xs md:text-sm px-3 py-1 rounded-full border border-white/10 bg-white/5"
                    >
                      {spec}
                    </span>
                  ))}
                </div>

                {/* Bottom line */}
                <div className="absolute bottom-0 left-0 h-[2px] w-0 bg-skyaccent group-hover:w-full transition-all duration-500" />
              </article>
            ))}
          </div>
        </section>

        <section id="services" className="px-4 py-20 md:px-10">
          <div className="mb-12 reveal">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-skyaccent md:text-sm">
              Services
            </p>
            <h2 className="font-display text-4xl tracking-wide md:text-6xl">
              From Planning to Final Delivery
            </h2>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {services.map((service, index) => (
              <article
                key={service.title}
                className="group relative p-6 rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl hover:-translate-y-2 transition"
              >
                {/* Big number background */}
                <div className="absolute -top-2 right-4 text-[70px] font-bold text-white/5">
                  0{index + 1}
                </div>

                <h3 className="relative z-10 text-xl font-semibold mb-2 mt-10">
                  {service.title}
                </h3>

                <p className="relative z-10 text-slate-300 text-sm leading-relaxed">
                  {service.copy}
                </p>

                {/* Animated line */}
                <div className="absolute bottom-0 left-0 h-[2px] w-0 bg-gradient-to-r from-skyaccent to-cyan-200 group-hover:w-full transition-all duration-500" />
              </article>
            ))}
          </div>
        </section>

        <section id="contact" className="px-4 pt-20 pb-20 md:px-10">
          <div className="reveal max-w-5xl mx-auto rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 to-black p-8 shadow-[0_20px_80px_rgba(0,0,0,0.6)]">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-skyaccent md:text-sm">
              Contact
            </p>

            <h2 className="font-display text-4xl md:text-6xl tracking-wide">
              Request a Flight
            </h2>

            <p className="mt-4 text-slate-300 max-w-xl">
              Submit your mission parameters and we’ll respond with a flight plan, timeline, and cost estimation.
            </p>

            {/* Requirements */}
            <div className="mt-8 grid gap-4 md:grid-cols-3 text-sm">
              {["Location", "Timeline", "Mission Type"].map((item) => (
                <div
                  key={item}
                  className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 flex items-center gap-2"
                >
                  <span className="text-skyaccent">▸</span>
                  {item}
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="mt-8 flex flex-wrap gap-4 justify-between">
              <div className="flex gap-4">
                <a
                  href="mailto:hello@skylineops.com"
                  className="px-5 py-3 rounded-full bg-gradient-to-r from-skyaccent to-cyan-200 text-slate-950 font-semibold"
                >
                  Send Email
                </a>

                <a
                  href="tel:+1234567890"
                  className="px-5 py-3 rounded-full border border-white/20 bg-white/5"
                >
                  Call Now
                </a>
              </div>

              <div className="flex gap-4">
                {/* Instagram */}
                <a
                  href="https://instagram.com/yourusername"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-2 px-3 py-2 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 transition"
                >
                  <FaInstagram className="text-2xl text-pink-400 group-hover:scale-110 transition" />
                </a>

                {/* YouTube */}
                <a
                  href="https://youtube.com/yourchannel"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-2 px-3 py-2 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 transition"
                >
                  <FaYoutube className="text-2xl text-red-500 group-hover:scale-110 transition" />
                </a>
              </div>
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
