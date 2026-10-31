// Which home-page sections have something to show. Shared by the home page and
// the navbar, so a nav link never points at a section that isn't there.
import { useSite } from '../context/SiteContext.jsx'
import { coupleNames } from '../lib/content.js'

const str = (v) => (typeof v === 'string' ? v.trim() : '')

/** The event whose venue the Venue section features: the first one with a venue. */
export const venueEvent = (events) => events.find((e) => e.venue_name || e.address) ?? null

export function useSiteSections() {
  const { content, events, settings } = useSite()
  const on = (key) => content.sections?.[key] !== false
  const { story, couple } = content
  const names = coupleNames(couple)
  return {
    countdown: on('countdown') && Boolean(settings.wedding_date),
    story: on('story') && Boolean(str(story.intro) || str(story.howWeMet?.text) || (story.timeline ?? []).some((t) => str(t?.title))),
    couple: on('couple') && Boolean(names.a || names.b || str(couple.fullNameOne) || str(couple.fullNameTwo)),
    events: on('events') && events.length > 0,
    venue: on('venue') && Boolean(venueEvent(events)),
    gallery: on('gallery'),
    rsvp: true, // always shown: when replies are closed it says so
    wishes: on('wishes'),
    info: on('info'),
  }
}

/** Navbar links. Anchors live on the home page; other pages link back to them. */
export function useNavItems() {
  const visible = useSiteSections()
  return [
    { to: '/', label: 'Home', end: true },
    visible.story && { to: '/#story', label: 'Our Story' },
    visible.events && { to: '/#events', label: 'Events' },
    visible.gallery && { to: '/#gallery', label: 'Gallery' },
    visible.venue && { to: '/#venue', label: 'Venue' },
    visible.wishes && { to: '/#wishes', label: 'Wishes' },
  ].filter(Boolean)
}
