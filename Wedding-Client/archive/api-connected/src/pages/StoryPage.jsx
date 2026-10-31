import { Heart } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { Couple } from '../components/sections/Couple.jsx'
import { OurStory } from '../components/sections/OurStory.jsx'
import { EmptyState } from '../components/ui/Feedback.jsx'
import { useSite } from '../context/SiteContext.jsx'
import { useSiteSections } from '../hooks/useSiteSections.js'

/** /story — the story timeline and the bride & groom, on their own. */
export default function StoryPage() {
  const { content, ready } = useSite()
  const visible = useSiteSections()
  if (ready && content.sections.story === false) return <Navigate to="/" replace />

  return (
    <div className="pt-16 sm:pt-[4.5rem]">
      {visible.story ? (
        <OurStory />
      ) : (
        ready && (
          <div className="px-4 py-28">
            <EmptyState icon={Heart} title="Our story is still being written">
              Check back soon.
            </EmptyState>
          </div>
        )
      )}
      {visible.couple && <Couple />}
    </div>
  )
}
