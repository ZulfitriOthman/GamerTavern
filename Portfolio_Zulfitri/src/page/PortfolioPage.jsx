import HeroSection from './components/HeroSection'
import SkillsSection from './components/SkillsSection'
import ProjectsSection from './components/ProjectsSection'
import ContactSection from './components/ContactSection'
import { projectSamples, skillCards } from './pageData'

function PortfolioPage() {

  return (
    <main className="mx-auto my-3 w-[calc(100%-1rem)] overflow-hidden rounded-2xl border border-[#d2c4ab] bg-[#fffdf8e0] shadow-[0_24px_40px_rgba(31,111,120,0.12)] md:my-6 md:w-[min(1120px,calc(100%-2rem))] md:rounded-[28px]">
      <HeroSection />
      <SkillsSection skillCards={skillCards} />
      <ProjectsSection projectSamples={projectSamples} />
      <ContactSection />
    </main>
  )
}

export default PortfolioPage