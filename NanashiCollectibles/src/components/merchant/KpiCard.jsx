import { Link } from "react-router-dom";
import Card from "../ui/Card.jsx";

export default function KpiCard({ label, value, tone = "default", to }) {
  const content = (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-amber-50/45">{label}</p>
      <p className={["mt-2 font-display text-2xl font-semibold sm:text-3xl", tone === "danger" ? "text-danger-400" : tone === "gold" ? "text-gold-300" : "text-amber-50"].join(" ")}>
        {value}
      </p>
    </>
  );

  if (to) {
    return (
      <Card as={Link} to={to} variant="interactive" className="block">
        {content}
      </Card>
    );
  }
  return <Card>{content}</Card>;
}
