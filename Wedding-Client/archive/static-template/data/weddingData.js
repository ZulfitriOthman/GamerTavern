// ============================================================================
//  All wedding content lives here — edit this one file to customise the site.
//  Everything below is PLACEHOLDER content for the design preview.
//
//  Photos: put files in src/assets/wedding/ with the file names below. Until a
//  file exists, an elegant placeholder is shown in its place automatically.
// ============================================================================

export const weddingData = {
  // Used for date formatting ('en-GB', 'ms-BN', …).
  locale: 'en-GB',

  couple: {
    bride: {
      firstName: 'Aisyah',
      fullName: 'Nur Aisyah binti Ahmad',
      role: 'The Bride',
      parents: 'Daughter of Ahmad bin Yusof & Siti Mariam binti Hassan',
      bio: 'An architect who sketches on every napkin she can find, loves rainy mornings and makes the best kuih in the family.',
      photo: 'bride.jpg',
      instagram: '',
    },
    groom: {
      firstName: 'Hakim',
      fullName: 'Muhammad Hakim bin Ismail',
      role: 'The Groom',
      parents: 'Son of Ismail bin Omar & Rohani binti Abdullah',
      bio: 'A software engineer with a soft spot for old films, long drives and terrible puns — and, apparently, for architects.',
      photo: 'groom.jpg',
      instagram: '',
    },
    hashtag: 'AisyahHakim2027',
  },

  // The main wedding moment: drives the hero, countdown and footer.
  // `time` is local time in `timeZone`.
  wedding: {
    date: '2027-01-22',
    time: '13:15',
    timeZone: 'Asia/Brunei',
    hijriDate: '14 Syaban 1448H',
    city: 'Bandar Seri Begawan, Brunei',
  },

  hero: {
    eyebrow: 'Together with their families',
    tagline: 'Together forever, beginning today',
    image: 'hero.jpg',
  },

  // Show the envelope opening animation on a guest's first visit.
  intro: { envelope: true },

  story: {
    intro: 'Every love story is beautiful, but ours is our favourite.',
    chapters: [
      {
        date: 'March 2019',
        title: 'How We Met',
        text: 'A borrowed umbrella on a rainy afternoon outside the library — and a promise to return it the next day.',
        image: 'story-1.jpg',
      },
      {
        date: 'April 2019',
        title: 'Our First Date',
        text: 'The umbrella was returned over teh tarik and roti canai. Three hours later, neither of us wanted to leave.',
        image: 'story-2.jpg',
      },
      {
        date: 'December 2025',
        title: 'The Proposal',
        text: 'At sunset by the sea, with both our families hiding nearby, he asked — and she said yes before he finished.',
        image: 'story-3.jpg',
      },
      {
        date: 'January 2027',
        title: 'Our Wedding',
        text: 'The beginning of our forever, and we would love for you to be there with us.',
        image: 'story-4.jpg',
      },
    ],
  },

  // Places referenced by events (by id).
  venues: [
    {
      id: 'masjid',
      name: 'Masjid An-Nur',
      address: 'Jalan Contoh 12, Kampung Placeholder\nBandar Seri Begawan BS1234, Brunei',
      image: 'venue-masjid.jpg',
      mapsUrl: '', // optional: paste a Google Maps link; otherwise a search link is built
      note: 'Parking is available in front of the main hall.',
    },
    {
      id: 'ballroom',
      name: 'The Ivory Ballroom',
      address: 'Level 3, Grand Placeholder Hotel\nJalan Pantai, Bandar Seri Begawan BS5678, Brunei',
      image: 'venue-ballroom.jpg',
      mapsUrl: '',
      note: 'Valet parking at the hotel lobby.',
    },
  ],

  events: [
    {
      id: 'akad',
      title: 'Akad Nikah',
      subtitle: 'The solemnisation',
      date: '2027-01-22',
      startTime: '09:00',
      endTime: '11:00',
      venueId: 'masjid',
      dressCode: 'Traditional attire in white or ivory',
      description: 'An intimate ceremony with family and close friends as we begin our marriage.',
      programme: [
        { time: '09:00', title: 'Arrival of guests' },
        { time: '09:30', endTime: '10:30', title: 'Akad Nikah' },
        { time: '10:30', title: 'Doa Selamat' },
      ],
    },
    {
      id: 'bersanding',
      title: 'Majlis Bersanding',
      subtitle: 'The celebration',
      date: '2027-01-22',
      startTime: '13:15',
      endTime: '16:00',
      venueId: 'ballroom',
      dressCode: 'Baju Melayu & baju kurung in champagne or sage',
      description: 'Join us as we sit side by side as husband and wife, surrounded by the people we love.',
      programme: [
        { time: '13:15', endTime: '14:15', title: 'Arrival of guests' },
        { time: '14:15', title: 'Arrival of the bride & groom' },
        { time: '14:30', title: 'Bersanding' },
        { time: '', title: 'Doa Selamat and lunch' },
      ],
    },
    {
      id: 'reception',
      title: 'Wedding Reception',
      subtitle: 'An evening together',
      date: '2027-01-23',
      startTime: '19:30',
      endTime: '22:30',
      venueId: 'ballroom',
      dressCode: 'Formal evening wear',
      description: 'An evening of dinner, music and memories with friends and colleagues.',
      programme: [
        { time: '19:30', title: 'Welcome reception' },
        { time: '20:00', title: 'Dinner' },
        { time: '21:00', title: 'Speeches & first dance' },
      ],
    },
  ],

  gallery: [
    { src: 'gallery-01.jpg', alt: 'The couple walking in a garden', caption: 'Pre-wedding, Tasek Lama', width: 4, height: 5 },
    { src: 'gallery-02.jpg', alt: 'Close-up of the engagement rings', caption: 'The rings', width: 1, height: 1 },
    { src: 'gallery-03.jpg', alt: 'The couple laughing by the sea', caption: 'Sunset at the beach', width: 3, height: 2 },
    { src: 'gallery-04.jpg', alt: 'Bridal bouquet of ivory roses', caption: 'Ivory roses', width: 4, height: 5 },
    { src: 'gallery-05.jpg', alt: 'The couple under an archway', caption: 'Under the arch', width: 3, height: 4 },
    { src: 'gallery-06.jpg', alt: 'Hands holding during the proposal', caption: 'The proposal', width: 3, height: 2 },
    { src: 'gallery-07.jpg', alt: 'Traditional songket detail', caption: 'Songket details', width: 1, height: 1 },
    { src: 'gallery-08.jpg', alt: 'The couple at the old library', caption: 'Where it began', width: 4, height: 5 },
    { src: 'gallery-09.jpg', alt: 'Table setting with candles and flowers', caption: 'The tablescape', width: 3, height: 2 },
  ],

  rsvp: {
    deadline: '2026-12-31',
    maxGuests: 4,
    // Shown on the form. Submissions are NOT sent anywhere in this design preview.
    previewNotice: 'RSVP submissions are not connected yet, so nothing you enter here is sent or saved.',
    contact: 'To reply now, please message the family directly.',
  },

  // Static example messages.
  wishes: [
    { name: 'Mak Long Zainab', relationship: 'Aunt', message: 'Selamat pengantin baru! May your home always be filled with love, laughter and barakah.' },
    { name: 'Farid & Hana', relationship: 'Friends', message: 'From a borrowed umbrella to forever — we could not be happier for you both. Congratulations!' },
    { name: 'Dr. Lim Wei Ling', relationship: 'Colleague', message: 'Wishing you a lifetime of adventures, patience and plenty of good coffee together.' },
    { name: 'Siti Nurhaliza', relationship: 'Cousin', message: 'Semoga berbahagia hingga ke Jannah. Love you both so much!' },
    { name: 'Uncle Rahman', relationship: 'Family friend', message: 'Marriage is a journey best shared. May yours be long, gentle and beautiful.' },
    { name: 'The Badminton Club', relationship: 'Friends', message: 'Congratulations to our favourite doubles pair — may every rally go your way!' },
  ],

  footer: {
    message: 'Thank you for being part of our special day.',
    closing: 'With love,',
  },
}
