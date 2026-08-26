import Container from "./Container.jsx";

const TONES = {
  default: "",
  muted: "bg-ink-900/60",
};

export default function Section({ tone = "default", className = "", containerClassName = "", children }) {
  return (
    <section className={["py-16 sm:py-20", TONES[tone], className].join(" ")}>
      <Container className={containerClassName}>{children}</Container>
    </section>
  );
}
