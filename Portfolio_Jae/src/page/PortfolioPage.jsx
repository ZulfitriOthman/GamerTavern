import HeroSection from './components/HeroSection'
import AboutSection from './components/AboutSection'
import SkillsSection from './components/SkillsSection'
import DatabaseSection from './components/DatabaseSection'
import ProjectsSection from './components/ProjectsSection'
import ContactSection from './components/ContactSection'
import ScrollReveal from './components/ScrollReveal'
import ScrollToTopButton from './components/ScrollToTopButton'
import {
  aboutMe,
  contactInfo,
  databaseWork,
  projectSamples,
  skillCards,
  toolDescriptions,
  toolStack,
} from './pageData'

function PortfolioPage({ aboutMeOverride, contactInfoOverride, onNavigate }) {

  return (
    <>
      <main className="mx-auto my-3 w-[calc(100%-1rem)] overflow-hidden rounded-2xl border border-[#2a2a2a] bg-[#0d0d0d] shadow-[0_24px_40px_rgba(239,68,68,0.15)] md:my-6 md:w-[min(1120px,calc(100%-2rem))] md:rounded-[28px]">
        <ScrollReveal delay={0}>
          <HeroSection toolStack={toolStack} toolDescriptions={toolDescriptions} />
        </ScrollReveal>
        <ScrollReveal delay={110}>
          <AboutSection aboutMe={aboutMeOverride || aboutMe} />
        </ScrollReveal>
        <ScrollReveal delay={220}>
          <SkillsSection skillCards={skillCards} />
        </ScrollReveal>
        <ScrollReveal delay={330}>
          <DatabaseSection databaseWork={databaseWork} />
        </ScrollReveal>
        <ScrollReveal delay={440}>
          <ProjectsSection projectSamples={projectSamples} />
        </ScrollReveal>
        <ScrollReveal delay={550}>
          <ContactSection contactInfo={contactInfoOverride || contactInfo} />
        </ScrollReveal>
      </main>
      <ScrollToTopButton />
      <div className="fixed bottom-5 left-5 z-40 flex flex-wrap gap-2 md:bottom-8 md:left-8">
        <button
          className="interactive-cta rounded-full border border-[#ef4444]/40 bg-[#161616] px-4 py-2 text-xs font-bold text-[#ef4444] shadow-[0_10px_24px_rgba(0,0,0,0.35)]"
          onClick={() => onNavigate('/login')}
          type="button"
        >
          Admin Login
        </button>
        <button
          className="interactive-cta rounded-full border border-[#ef4444]/40 bg-[#ef4444]/10 px-4 py-2 text-xs font-bold text-[#ef4444] shadow-[0_10px_24px_rgba(0,0,0,0.35)]"
          onClick={() => onNavigate('/client/access')}
          type="button"
        >
          Client Portal
        </button>
      </div>
    </>
  )
}

export default PortfolioPage