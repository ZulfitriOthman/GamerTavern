import Section from "../components/layout/Section.jsx";
import Button from "../components/ui/Button.jsx";

export default function NotFoundPage() {
  return (
    <Section spacing="lg" className="flex flex-col items-center gap-4 pt-14 text-center sm:pt-20">
      <span className="font-display text-6xl font-semibold text-amber-50/20">404</span>
      <h1 className="font-display text-2xl font-semibold text-amber-50">Page not found</h1>
      <p className="max-w-md text-sm text-amber-50/60">
        The page you're looking for doesn't exist or hasn't been built yet.
      </p>
      <Button to="/">Back to home</Button>
    </Section>
  );
}
