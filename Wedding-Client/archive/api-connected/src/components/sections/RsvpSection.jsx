import { useSite } from '../../context/SiteContext.jsx'
import { labels } from '../../lib/labels.js'
import { DeadlinePill, RsvpPanel } from '../rsvp/RsvpPanel.jsx'
import { Section, SectionTitle } from '../ui/Section.jsx'

/** RSVP on the home page (open replies). Personal links use /rsvp/:token. */
export function RsvpSection() {
  const { locale } = useSite()
  return (
    <Section id="rsvp" tone="beige">
      <RsvpPanel
        renderHeading={() => (
          <SectionTitle kicker={labels(locale).rsvpKicker} title="RSVP" className="mb-12">
            <p>We would be honoured by your presence. Kindly let us know if you can join us.</p>
            <DeadlinePill className="mt-4" />
          </SectionTitle>
        )}
      />
    </Section>
  )
}
