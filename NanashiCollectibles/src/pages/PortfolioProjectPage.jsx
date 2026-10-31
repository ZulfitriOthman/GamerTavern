import { useParams } from "react-router-dom";
import Section from "../components/layout/Section.jsx";
import SectionHeading from "../components/ui/SectionHeading.jsx";
import Breadcrumb from "../components/ui/Breadcrumb.jsx";
import Card from "../components/ui/Card.jsx";
import Badge from "../components/ui/Badge.jsx";
import Button from "../components/ui/Button.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import ProjectStatusBadge from "../components/portfolio/ProjectStatusBadge.jsx";
import { getProjectBySlug } from "../data/portfolioProjects.js";

function isExternal(url) {
  return /^https?:\/\//.test(url);
}

function DetailBlock({ title, children }) {
  if (!children) return null;
  return (
    <div>
      <h2 className="font-display text-lg font-semibold text-amber-50">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-amber-50/70">{children}</p>
    </div>
  );
}

function LinkButtons({ project }) {
  const { live, appStore, playStore } = project.links || {};
  const buttons = [];

  if (live) {
    buttons.push(
      isExternal(live) ? (
        <Button key="live" href={live} target="_blank" rel="noopener noreferrer">
          Visit Live Site
        </Button>
      ) : (
        <Button key="live" to={live}>
          Visit Live Site
        </Button>
      )
    );
  }
  if (appStore) {
    buttons.push(
      <Button key="app-store" href={appStore} target="_blank" rel="noopener noreferrer" variant="secondary">
        App Store
      </Button>
    );
  }
  if (playStore) {
    buttons.push(
      <Button key="play-store" href={playStore} target="_blank" rel="noopener noreferrer" variant="secondary">
        Google Play
      </Button>
    );
  }

  // No GitHub button ever renders here — no project in data/portfolioProjects.js
  // has an evidenced repository link, so `project.links.github` is never set.

  if (buttons.length === 0) return null;
  return <div className="flex flex-wrap gap-3">{buttons}</div>;
}

export default function PortfolioProjectPage() {
  const { slug } = useParams();
  const project = getProjectBySlug(slug);

  if (!project) {
    return (
      <Section spacing="lg" className="pt-14 sm:pt-20">
        <ErrorState
          icon="sparkle"
          title="Project not found"
          description="This project doesn't exist yet, or the link is out of date."
          action={<Button to="/portfolio">Back to Portfolio</Button>}
        />
      </Section>
    );
  }

  const { detail } = project;

  return (
    <>
      <Section spacing="lg" className="pt-14 sm:pt-20">
        <Breadcrumb
          items={[
            { label: "Portfolio", to: "/portfolio" },
            { label: project.name },
          ]}
        />

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <ProjectStatusBadge status={project.status} />
        </div>

        <SectionHeading className="mt-4" title={project.name} description={project.shortDescription} />

        <div className="mt-6 flex flex-wrap gap-1.5">
          {project.stack.map((tech) => (
            <Badge key={tech}>{tech}</Badge>
          ))}
        </div>

        <div className="mt-6">
          <LinkButtons project={project} />
        </div>
      </Section>

      {project.image ? (
        <Section spacing="sm" className="pt-0">
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <img src={project.image} alt="" loading="lazy" className="w-full object-cover" />
          </div>
        </Section>
      ) : null}

      <Section tone="muted" spacing="md">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div className="flex flex-col gap-8">
            <DetailBlock title="Overview">{detail.overview}</DetailBlock>
            <DetailBlock title="Problem">{detail.problem}</DetailBlock>
            <DetailBlock title="Solution">{detail.solution}</DetailBlock>
            <DetailBlock title="Challenges">{detail.challenges}</DetailBlock>
            <DetailBlock title="Outcome">{detail.outcome}</DetailBlock>
          </div>

          <Card variant="elevated" className="flex flex-col gap-5">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-50/45">My Role</h3>
              <p className="mt-2 text-sm leading-relaxed text-amber-50/75">{project.role}</p>
            </div>

            {detail.features?.length ? (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-50/45">Features</h3>
                <ul className="mt-2 flex flex-col gap-2 text-sm text-amber-50/70">
                  {detail.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>
        </div>
      </Section>

      <Section spacing="md" className="pb-24">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold text-amber-50">More work</h2>
            <p className="mt-1 text-sm text-amber-50/60">See everything else on the portfolio.</p>
          </div>
          <Button to="/portfolio" variant="secondary">
            Back to Portfolio
          </Button>
        </div>
      </Section>
    </>
  );
}
