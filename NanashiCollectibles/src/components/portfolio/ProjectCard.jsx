import { useRef, useState } from "react";
import Badge from "../ui/Badge.jsx";
import Button from "../ui/Button.jsx";
import Icon from "../ui/Icon.jsx";
import ProjectStatusBadge from "./ProjectStatusBadge.jsx";
import { portfolioCategories } from "../../data/portfolioProjects.js";

function isExternal(url) {
  return /^https?:\/\//.test(url);
}

// "View Project" opens whichever real link the project actually has — an
// external live site, an internal route (RVS Esports -> /esports, or "/" for
// NanashiCollectibles itself), or an app/play store listing. A project with
// none of those (the ticketing prototype, the vessel tracking system) simply
// has no primary action here, only "View Details" — never a fabricated link.
function PrimaryLinkButton({ project }) {
  const { live, appStore, playStore } = project.links || {};

  if (live) {
    return isExternal(live) ? (
      <Button href={live} target="_blank" rel="noopener noreferrer" size="sm" variant="secondary" className="w-full sm:w-auto">
        View Project
      </Button>
    ) : (
      <Button to={live} size="sm" variant="secondary" className="w-full sm:w-auto">
        View Project
      </Button>
    );
  }

  if (appStore || playStore) {
    return (
      <Button href={appStore || playStore} target="_blank" rel="noopener noreferrer" size="sm" variant="secondary" className="w-full sm:w-auto">
        View Listing
      </Button>
    );
  }

  return null;
}

// Built as a plain div rather than components/ui/SpotlightCard.jsx — that
// component wraps components/ui/Card.jsx, whose padding/background/border are
// fixed per variant and not reliably overridable via className (Tailwind's
// cascade order depends on source order, not the order classes are listed in
// a className string). components/shop/ProductCard.jsx hit the same
// requirement (edge-to-edge image + padded content below) and solved it the
// same way — a hand-rolled card with the same pointer-driven spotlight
// technique, written straight to a CSS custom property so hovering never
// triggers a React re-render.
export default function ProjectCard({ project, className = "" }) {
  const nodeRef = useRef(null);
  const [imageFailed, setImageFailed] = useState(false);
  const categoryLabel = portfolioCategories.find((c) => c.key === project.category)?.label;
  const showImage = project.image && !imageFailed;

  function handlePointerMove(event) {
    const node = nodeRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    node.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
    node.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
  }

  return (
    <div
      ref={nodeRef}
      onPointerMove={handlePointerMove}
      className={[
        "group relative flex flex-col overflow-hidden rounded-xl border border-white/10 bg-ink-800/60 backdrop-blur-sm transition-colors duration-200 hover:border-white/20",
        className,
      ].join(" ")}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(circle at var(--spot-x, 50%) var(--spot-y, 50%), rgba(108, 86, 232, 0.14), transparent 70%)",
        }}
      />

      <div className="relative aspect-video w-full shrink-0 overflow-hidden bg-ink-900">
        {showImage ? (
          <img
            src={project.image}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-brand-300">
              <Icon name={project.icon || "sparkle"} className="h-6 w-6" />
            </span>
          </div>
        )}
        <div className="absolute left-2.5 top-2.5 z-20">
          <ProjectStatusBadge status={project.status} className="text-[10px]" />
        </div>
      </div>

      <div className="relative flex flex-1 flex-col gap-3 p-5">
        <div>
          {categoryLabel ? (
            <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-50/40">{categoryLabel}</p>
          ) : null}
          <h3 className="mt-1 font-display text-lg font-semibold text-amber-50">{project.name}</h3>
        </div>

        <p className="text-sm leading-relaxed text-amber-50/65">{project.shortDescription}</p>

        <div className="flex flex-wrap gap-1.5">
          {project.stack.slice(0, 4).map((tech) => (
            <Badge key={tech} className="text-[10px]">
              {tech}
            </Badge>
          ))}
          {project.stack.length > 4 ? <Badge className="text-[10px]">+{project.stack.length - 4}</Badge> : null}
        </div>

        <div className="mt-auto flex flex-col gap-2 pt-2 sm:flex-row">
          <Button to={`/portfolio/${project.slug}`} size="sm" className="w-full sm:w-auto">
            View Details
          </Button>
          <PrimaryLinkButton project={project} />
        </div>
      </div>
    </div>
  );
}
