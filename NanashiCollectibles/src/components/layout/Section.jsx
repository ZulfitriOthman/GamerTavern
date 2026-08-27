import Container from "./Container.jsx";

const TONES = {
  default: "",
  muted: "bg-ink-900/60",
};

const SPACING = {
  sm: "py-10 sm:py-12",
  md: "py-16 sm:py-20",
  lg: "py-20 sm:py-28",
};

export default function Section({
  tone = "default",
  spacing = "md",
  containerSize,
  className = "",
  containerClassName = "",
  children,
}) {
  return (
    <section className={[SPACING[spacing], TONES[tone], className].join(" ")}>
      <Container size={containerSize} className={containerClassName}>
        {children}
      </Container>
    </section>
  );
}
