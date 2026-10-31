import { useMemo, useState } from "react";
import ProjectCard from "./ProjectCard.jsx";
import EmptyState from "../ui/EmptyState.jsx";
import { portfolioCategories, portfolioProjects } from "../../data/portfolioProjects.js";

// Lightweight, client-side only — no URL sync, no query params. Filter pills
// are derived from which categories actually have a project in them, so
// "Experiments" (or any future empty category) never shows up as a dead
// option, and a new category added to portfolioProjects.js appears here for
// free.
export default function ProjectGrid() {
  const [activeCategory, setActiveCategory] = useState("all");

  const availableCategories = useMemo(() => {
    const used = new Set(portfolioProjects.map((p) => p.category));
    return portfolioCategories.filter((c) => used.has(c.key));
  }, []);

  const filtered = useMemo(() => {
    if (activeCategory === "all") return portfolioProjects;
    return portfolioProjects.filter((p) => p.category === activeCategory);
  }, [activeCategory]);

  const filters = [{ key: "all", label: "All" }, ...availableCategories];

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter projects by category">
        {filters.map((filter) => {
          const isActive = activeCategory === filter.key;
          return (
            <button
              key={filter.key}
              type="button"
              onClick={() => setActiveCategory(filter.key)}
              aria-pressed={isActive}
              className={[
                "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors duration-150 focus-ring",
                isActive
                  ? "border-brand-400/60 bg-brand-500/15 text-brand-200"
                  : "border-white/10 bg-white/5 text-amber-50/60 hover:border-white/20 hover:text-amber-50",
              ].join(" ")}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      {filtered.length > 0 ? (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((project) => (
            <ProjectCard key={project.slug} project={project} />
          ))}
        </div>
      ) : (
        <EmptyState
          className="mt-6"
          title="No projects in this category yet"
          description="Check back soon — this list grows as new work ships."
        />
      )}
    </div>
  );
}
