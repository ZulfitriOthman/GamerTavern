import { Link } from "react-router-dom";
import { heroReel } from "./pageData";

function HomePage() {
  return (
    <>
      <section className="relative min-h-[92vh] overflow-hidden px-4 pb-12 pt-32 md:px-10">
        <video
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
        >
          <source src={heroReel} type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-[linear-gradient(130deg,rgba(10,15,22,0.65)_0%,rgba(10,15,22,0.15)_50%,rgba(10,15,22,0.60)_100%),linear-gradient(180deg,rgba(10,15,22,0)_0%,rgba(10,15,22,0.55)_100%)]" />

        <div className="relative z-10 reveal">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-skyaccent md:text-sm">
            Licensed Drone Operator
          </p>
          <h1 className="max-w-[13ch] font-display text-5xl leading-[0.95] tracking-wide md:text-8xl">
            Aerial Storytelling with Precision and Edge.
          </h1>
          <p className="mt-4 max-w-2xl text-sm text-slate-300 md:text-base">
            I fly for brands, real estate, events and inspections. Every frame is captured with safe operations and cinematic
            intent.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/contact"
              className="rounded-full bg-gradient-to-r from-skyaccent to-cyan-200 px-5 py-3 font-semibold text-slate-950"
            >
              Move to contact
            </Link>
            <Link
              to="/work"
              className="rounded-full border border-white/25 bg-white/10 px-5 py-3 font-semibold text-white"
            >
              Watch Highlights
            </Link>
          </div>
        </div>

        <div className="relative z-10 mt-12 grid gap-4 md:mt-24 md:grid-cols-3 reveal">
          {[
            ["250+ Hrs", "Flight Time Logged"],
            ["4K/5.1K", "Capture Quality"],
            ["100%", "Safety First Workflow"],
          ].map(([value, label]) => (
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
        <div className="reveal mx-auto max-w-5xl rounded-3xl border border-white/15 bg-gradient-to-br from-slate-900/90 to-slate-800/80 p-6 shadow-panel md:p-8">
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
      </section>
    </>
  );
}

export default HomePage;
