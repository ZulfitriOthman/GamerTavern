import Section from "../components/layout/Section.jsx";
import SectionHeading from "../components/ui/SectionHeading.jsx";
import PortfolioHero from "../components/portfolio/PortfolioHero.jsx";
import SkillsSection from "../components/portfolio/SkillsSection.jsx";
import ProjectGrid from "../components/portfolio/ProjectGrid.jsx";
import ExperienceSection from "../components/portfolio/ExperienceSection.jsx";
import CapabilitiesSection from "../components/portfolio/CapabilitiesSection.jsx";
import CurrentlyBuilding from "../components/portfolio/CurrentlyBuilding.jsx";
import PortfolioCTA from "../components/portfolio/PortfolioCTA.jsx";
import { aboutMe } from "../data/portfolioContent.js";

export default function PortfolioPage() {
  return (
    <>
      <PortfolioHero />

      <Section spacing="lg">
        <SectionHeading eyebrow="About" title="About Me" size="section" />
        <div className="mt-6 flex max-w-2xl flex-col gap-4 text-base leading-relaxed text-amber-50/70">
          {aboutMe.map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>
      </Section>

      <Section tone="muted" spacing="lg">
        <SectionHeading eyebrow="Capabilities" title="Technical Capabilities" size="section" />
        <div className="mt-6">
          <SkillsSection />
        </div>
      </Section>

      <div id="projects">
        <Section spacing="lg">
          <SectionHeading
            eyebrow="Work"
            title="Featured Projects"
            description="Real, delivered work — this platform included. Status is labeled honestly: live production systems and in-progress builds are never presented the same way."
            size="section"
          />
          <div className="mt-6">
            <ProjectGrid />
          </div>
        </Section>
      </div>

      <Section tone="muted" spacing="lg">
        <SectionHeading eyebrow="Background" title="Experience & Education" size="section" />
        <div className="mt-8">
          <ExperienceSection />
        </div>
      </Section>

      <Section spacing="lg">
        <SectionHeading eyebrow="Services" title="What I Can Build" size="section" />
        <div className="mt-6">
          <CapabilitiesSection />
        </div>
      </Section>

      <Section tone="muted" spacing="md">
        <SectionHeading title="Currently Building" size="section" />
        <div className="mt-6">
          <CurrentlyBuilding />
        </div>
      </Section>

      <Section spacing="lg" className="pb-24">
        <PortfolioCTA />
      </Section>
    </>
  );
}
