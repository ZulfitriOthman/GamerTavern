// Website content model.
//
// The live values are stored by the Wedding API in wedding_settings.content and
// edited in /admin → Settings. They are deep-merged over these defaults, which
// are deliberately neutral placeholders: no personal wedding details live in
// the frontend code. Empty fields are hidden from guests.
//
// The shape is the same as the Wedding/ site's (same API code), but this site
// stores its content in its own database.

export const defaultContent = {
  locale: 'en-GB',
  hijriDate: '',
  couple: {
    partnerOne: '',
    partnerTwo: '',
    fullNameOne: '',
    fullNameTwo: '',
    monogram: '',
    hashtag: '',
    // Bride & groom profile cards. Names come from partnerOne/fullNameOne and partnerTwo/fullNameTwo.
    profiles: {
      one: { role: '', photoUrl: '', parents: '', bio: '', instagram: '' },
      two: { role: '', photoUrl: '', parents: '', bio: '', instagram: '' },
    },
  },
  hero: {
    eyebrow: 'Together with their families',
    tagline: '',
    imageUrl: '',
  },
  invitation: {
    bismillah: '',
    salam: '',
    heading: '',
    salutation: '',
    nameNote: '',
    message: '',
    conjunction: '&',
    closing: '',
    familyHeading: '',
    familyGroups: [], // [{ title, members: 'one name per line' }]
  },
  story: {
    intro: '',
    howWeMet: { title: '', text: '', imageUrl: '' },
    timeline: [], // [{ date, title, text, imageUrl }]
  },
  info: {
    scheduleNote: '',
    dressCodeNote: '',
    travelNote: '',
    faq: [], // [{ q, a }]
    contacts: [], // [{ name, role, phone, email }]
    gifts: { enabled: false, message: '', bankName: '', accountName: '', accountNumber: '' },
  },
  sections: {
    countdown: true,
    envelope: true,
    story: false,
    couple: true, // bride & groom cards (shown once names are set)
    events: true,
    venue: true, // venue section with map, built from the first event that has a venue
    gallery: true,
    wishes: true,
    info: true,
  },
  footer: { message: '' },
}

// Fallbacks for the server-enforced settings columns.
export const defaultSettings = {
  wedding_date: null,
  wedding_time: null,
  timezone: 'Asia/Brunei',
  rsvp_mode: 'closed',
  rsvp_deadline: null,
  greetings_enabled: false,
  greetings_auto_approve: false,
  photo_uploads_enabled: false,
}
