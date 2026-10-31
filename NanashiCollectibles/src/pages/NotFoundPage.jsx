import Section from "../components/layout/Section.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";

export default function NotFoundPage() {
  return (
    <Section spacing="lg" className="pt-14 sm:pt-20">
      <ErrorState
        code="404"
        title="Page not found"
        description="The page you're looking for doesn't exist or hasn't been built yet."
      />
    </Section>
  );
}
