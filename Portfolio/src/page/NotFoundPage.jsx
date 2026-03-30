import { Link } from "react-router-dom";

function NotFoundPage() {
  return (
    <section className="grid min-h-[70vh] place-content-center px-4 pb-14 pt-28 text-center md:px-10 md:pt-32">
      <h2 className="font-display text-5xl tracking-wide md:text-7xl">404</h2>
      <p className="mt-3 text-slate-300">This route does not exist.</p>
      <Link
        to="/"
        className="mt-6 rounded-full bg-gradient-to-r from-skyaccent to-cyan-200 px-5 py-3 font-semibold text-slate-950"
      >
        Back to Home
      </Link>
    </section>
  );
}

export default NotFoundPage;
