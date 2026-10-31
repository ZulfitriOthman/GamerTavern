import Button from "../ui/Button.jsx";

export default function PortfolioCTA() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-gradient-to-br from-brand-500/10 via-transparent to-signal-500/10 p-10 text-center sm:p-14">
      <h2 className="font-display text-2xl font-semibold text-amber-50 sm:text-3xl">Have a project in mind?</h2>
      <p className="max-w-md text-base text-amber-50/65">Let's build something useful.</p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <Button to="/contact" size="lg">
          Get in Touch
        </Button>
        <Button to="/services" variant="secondary" size="lg">
          View Services
        </Button>
      </div>
    </div>
  );
}
