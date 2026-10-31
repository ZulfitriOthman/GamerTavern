import SpotlightCard from "../ui/SpotlightCard.jsx";
import Badge from "../ui/Badge.jsx";
import Icon from "../ui/Icon.jsx";
import Button from "../ui/Button.jsx";
import ProjectStatusBadge from "./ProjectStatusBadge.jsx";
import { portfolioProjects } from "../../data/portfolioProjects.js";

// Data-driven: pulls whichever project(s) are flagged `currentlyBuilding: true`
// in data/portfolioProjects.js, so updating what's "currently building" is a
// one-line data change, not a JSX edit.
export default function CurrentlyBuilding() {
  const current = portfolioProjects.filter((p) => p.currentlyBuilding);
  if (current.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {current.map((project) => (
        <SpotlightCard key={project.slug} variant="default" className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-brand-300">
            <Icon name={project.icon || "sparkle"} className="h-6 w-6" />
          </span>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="signal">Currently Building</Badge>
              <ProjectStatusBadge status={project.status} />
            </div>
            <h3 className="mt-2 font-display text-lg font-semibold text-amber-50">{project.name}</h3>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-amber-50/65">{project.shortDescription}</p>
          </div>
          <Button to={`/portfolio/${project.slug}`} variant="secondary" size="sm" className="shrink-0">
            View Details
          </Button>
        </SpotlightCard>
      ))}
    </div>
  );
}
