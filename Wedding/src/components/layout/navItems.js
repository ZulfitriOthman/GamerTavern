/** Builds the public navigation from the enabled sections. */
export function navItems(content, settings) {
  const s = content.sections
  return [
    { to: '/', label: 'Home', show: true },
    { to: '/story', label: 'Our Story', show: s.story },
    { to: '/events', label: 'Events', show: s.events },
    { to: '/gallery', label: 'Gallery', show: s.gallery },
    { to: '/share', label: 'Share Photos', show: settings.photo_uploads_enabled, mobileOnly: true },
    { to: '/wishes', label: 'Wishes', show: settings.greetings_enabled },
    { to: '/info', label: 'Details', show: s.info },
  ].filter((i) => i.show)
}
