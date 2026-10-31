import { useRef } from "react";
import { Link } from "react-router-dom";
import aboutImage from "../../assets/images/about-me.jpg";

const stats = [
  ["2", "Aircraft in the Fleet"],
  ["12+", "Locations Flown Across Brunei"],
  ["5.4K", "Max Capture Resolution"],
];

function HomePage() {
  const heroRef = useRef(null);
  const reducedMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const handlePointerMove = (event) => {
    if (reducedMotion || !heroRef.current) return;
    const rect = heroRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    heroRef.current.style.setProperty("--spot-x", `${x}%`);
    heroRef.current.style.setProperty("--spot-y", `${y}%`);
  };

  return (
    <>
      <section
        ref={heroRef}
        onMouseMove={handlePointerMove}
        className="relative min-h-[92vh] overflow-hidden px-4 pb-12 pt-32 md:px-10"
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(39,210,255,0.28),transparent_42%),radial-gradient(circle_at_85%_75%,rgba(255,143,63,0.2),transparent_45%),linear-gradient(180deg,#0a0f15_0%,#0c131b_45%,#0d141d_100%)]"
        />
        <div aria-hidden="true" className="hero-spotlight absolute inset-0" />
        <div
          aria-hidden="true"
          className="hero-grid absolute inset-0 opacity-[0.15]"
        />

        <div className="relative z-10 reveal">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-skyaccent md:text-sm">
            Drone Pilot, Brunei
          </p>
          <h1 className="reveal-blur max-w-[13ch] font-display text-5xl leading-[0.95] tracking-wide md:text-8xl">
            Aerial Storytelling with Precision and Edge.
          </h1>
          <p className="mt-4 max-w-2xl text-sm text-slate-300 md:text-base">
            I fly for brands, real estate, events and inspections. Every frame is captured with safe operations and cinematic
            intent.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/contact"
              className="rounded-full bg-gradient-to-r from-skyaccent to-cyan-200 px-5 py-3 font-semibold text-slate-950 transition hover:brightness-110"
            >
              Move to contact
            </Link>
            <Link
              to="/work"
              className="rounded-full border border-white/25 bg-white/10 px-5 py-3 font-semibold text-white transition hover:border-white/50 hover:bg-white/15"
            >
              Watch Highlights
            </Link>
          </div>
        </div>

        <div className="relative z-10 mt-12 grid gap-4 md:mt-24 md:grid-cols-3 reveal">
          {stats.map(([value, label]) => (
            <article
              key={label}
              className="rounded-2xl border border-white/20 bg-slate-900/65 p-4 shadow-panel"
            >
              <h2 className="font-display text-4xl tracking-wide">{value}</h2>
              <p className="text-sm text-slate-300">{label}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="px-4 pt-14 md:px-10 md:pt-20">
        <div className="reveal relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-white/15 shadow-panel">
          <img
            src={aboutImage}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover opacity-70"
          />
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(8,12,18,0.92)_0%,rgba(8,12,18,0.82)_42%,rgba(8,12,18,0.94)_100%)]" />

          <div className="relative z-10 p-6 md:p-8">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-skyaccent md:text-sm">
              About Me
            </p>
            <div className="grid gap-6 md:grid-cols-[1fr_1.2fr] md:gap-8">
              <div>
                <h2 className="font-display text-4xl tracking-wide md:text-5xl">
                  I am drawn to challenges, and flying gave that drive a direction.
                </h2>
              </div>
              <div className="space-y-4 text-slate-300">
                <p>
                  Aviation was always part of my dream, even though it was not a path I could fully pursue. When I first
                  discovered drones, I saw them as a hobby, something exciting that let me experience a small part of that
                  dream from a different angle.
                </p>
                <p>
                  The more I learned, especially when I started flying manual, the more everything changed. It stopped being
                  just about having fun. Manual flying demanded focus, control, precision, and confidence, and that level of
                  challenge was exactly what pulled me in even deeper.
                </p>
                <p>
                  That is when I started thinking bigger. Instead of keeping drones as only a hobby, I wanted to take them
                  seriously and use them professionally. For me, this work is not only about visuals. It is about pushing my
                  skills, taking on more demanding flights, and turning passion into something meaningful.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export default HomePage;
