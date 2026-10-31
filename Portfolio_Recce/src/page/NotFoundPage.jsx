import { Link } from "react-router-dom";

function NotFoundPage() {
  return (
    <section className="relative grid min-h-[80vh] place-content-center overflow-hidden px-4 pb-14 pt-28 text-center md:px-10 md:pt-32">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(39,210,255,0.18),transparent_45%),linear-gradient(180deg,#0a0f15_0%,#0c131b_45%,#0d141d_100%)]"
      />
      <div aria-hidden="true" className="hero-grid absolute inset-0 opacity-[0.12]" />

      <div className="reveal relative z-10">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-skyaccent">
          Off Course
        </p>
        <h1 className="font-display text-6xl tracking-wide md:text-8xl">404</h1>
        <p className="mt-3 text-slate-300">
          This flight path doesn't exist. The page you're looking for has drifted off the map.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/"
            className="rounded-full bg-gradient-to-r from-skyaccent to-cyan-200 px-5 py-3 font-semibold text-slate-950 transition hover:brightness-110"
          >
            Back to Home
          </Link>
          <Link
            to="/work"
            className="rounded-full border border-white/25 bg-white/10 px-5 py-3 font-semibold text-white transition hover:border-white/50 hover:bg-white/15"
          >
            View the Work
          </Link>
        </div>
      </div>
    </section>
  );
}

export default NotFoundPage;
