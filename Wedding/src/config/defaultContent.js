// Website content model and its fallback values.
//
// The live values come from MySQL (wedding_settings.content, seeded by
// database/seeds/001_wedding_information.sql and edited in /admin/settings)
// and are deep-merged over these. The confirmed invitation details are kept
// here too so the site still shows correct information if the API is briefly
// unreachable. Fields not stated on the invitation are left EMPTY — empty
// fields are hidden from guests and remain editable in the dashboard.

export const defaultContent = {
  locale: 'ms-BN',
  hijriDate: '22 Rejab 1448',
  couple: {
    partnerOne: 'Zulfitri',
    partnerTwo: 'Mariah',
    fullNameOne: 'Awang Muhammad Zulfitri Bin Othman',
    fullNameTwo: 'Dayang Siti Mariah Binti Abdullah @ Md Yusof',
    monogram: 'ZM',
    hashtag: '',
  },
  hero: {
    eyebrow: 'Undangan Majlis Bersanding',
    tagline: '',
    imageUrl: '',
  },
  invitation: {
    bismillah: 'بِسْمِ ٱللَّٰهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
    salam: 'السَّلاَمُ عَلَيْكُمْ وَرَحْمَةُ اللهِ وَبَرَكَاتُهُ',
    heading: 'Undangan Majlis Bersanding',
    salutation: 'Yang Mulia',
    nameNote: 'Mohon maaf jika terdapat kesilapan dalam penulisan nama dan gelaran',
    message:
      'Dengan penuh hormat dan takzim sukacita menjunjung Pengiran berangkat/Mempersilakan Pehin/Dato/Datin/Awang dan Dayang hadir ke Majlis Bersanding anak peramba/kaola kami:',
    conjunction: 'Dengan',
    closing:
      'Di atas kesudian keberangkatan Pengiran dan kehadiran Pehin/Dato/Datin/Awang dan Dayang ke majlis ini terlebih dahulu abis peramba / kaola kami serta ahli keluarga dengan tulus ikhlas ingin menyembahkan / mengucapkan setinggi-tinggi penghargaan dan ribuan terima kasih serta bertawakkal pada Allah Subhanahu Wata’ala.',
    familyHeading: 'Yang Berharap',
    // Family names come only from MySQL (invitation.familyGroups) — no fallback list.
    familyGroups: [],
  },
  story: {
    intro: '',
    howWeMet: { title: '', text: '', imageUrl: '' },
    timeline: [],
  },
  info: {
    scheduleNote: '',
    dressCodeNote: '',
    travelNote: '',
    faq: [],
    contacts: [],
    gifts: { enabled: false, message: '', bankName: '', accountName: '', accountNumber: '' },
  },
  sections: {
    countdown: true,
    envelope: true,
    story: false, // enable in Settings once the story has been written
    events: true,
    gallery: true,
    info: true,
  },
  footer: { message: '' },
}

// Fallbacks for the server-enforced settings columns.
export const defaultSettings = {
  wedding_date: '2027-01-01',
  wedding_time: '13:30:00',
  timezone: 'Asia/Brunei',
  rsvp_mode: 'open',
  rsvp_deadline: null,
  greetings_enabled: true,
  greetings_auto_approve: false,
  photo_uploads_enabled: true,
}
