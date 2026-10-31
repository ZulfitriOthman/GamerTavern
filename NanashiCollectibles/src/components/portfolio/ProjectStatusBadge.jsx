import Badge from "../ui/Badge.jsx";
import { PROJECT_STATUS } from "../../data/portfolioProjects.js";

// Distinct from components/ui/StatusBadge.jsx — that one renders the backend's
// order/payment/merchant status vocabulary verbatim. Portfolio project status
// (LIVE / IN_DEVELOPMENT / PROTOTYPE / CONCEPT) is a separate, portfolio-only
// vocabulary defined in data/portfolioProjects.js, so it gets its own thin
// wrapper around the same Badge primitive instead of overloading that map.
export default function ProjectStatusBadge({ status, className = "" }) {
  const entry = PROJECT_STATUS[status];
  if (!entry) return null;
  return (
    <Badge tone={entry.tone} className={className}>
      {entry.label}
    </Badge>
  );
}
