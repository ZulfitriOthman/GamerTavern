// /rsvp and personal /rsvp/:token links (the link format already sent to guests).
import { useParams } from 'react-router-dom'
import { DeadlinePill, RsvpPanel } from '../components/rsvp/RsvpPanel.jsx'
import { PageHeader } from '../components/ui/Section.jsx'

export default function RsvpPage() {
  const { token } = useParams()
  return (
    <section className="bg-beige px-4 pb-20">
      <RsvpPanel
        token={token}
        renderHeading={(guestName) => (
          <PageHeader eyebrow="Kindly reply" title={guestName ? `Dear ${guestName}` : 'RSVP'}>
            <p>We would love to celebrate with you. Please let us know if you can join us.</p>
            <DeadlinePill className="mt-4" />
          </PageHeader>
        )}
      />
    </section>
  )
}
