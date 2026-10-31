// ============================================================================
//  All website content for the majlis lives here. Components only read it.
//
//  Names, titles, dates, the venue and the programme are reproduced EXACTLY as
//  supplied — keep the spelling and capitalisation when editing.
// ============================================================================

export const weddingData = {
  // Used for date formatting and the page language.
  locale: 'ms-BN',

  // Text for the browser tab and WhatsApp / social link previews (injected
  // into index.html at build time by vite.config.js).
  site: {
    // The live address. WhatsApp and other previews need absolute links, so
    // og:url and og:image are built from it. Change it if the site moves.
    url: 'https://devwedding.nanashicollectibles.com',
    title: 'Naqiuddin & Syafina – Majlis Menghantar Berian, Akad Nikah & Bersanding',
    description:
      'Jemputan ke Majlis Menghantar Berian, Akad Nikah & Bersanding Naqiuddin & Syafina · Jumaat, 22 Januari 2027 · 14 Syaaban 1448H · Damai Ballroom Aman Hills, Bandar Seri Begawan',
    ogImage: '/og-image.jpg', // 1200 × 630, in public/; regenerate with tools/og-image
  },

  // The bride and groom. `fullName` is the official name for the formal
  // invitation; `name` is the shorter form for the hero; `short` is for
  // decorative headings ("Naqiuddin & Syafina") and `initial` for the monogram.
  couple: {
    groom: {
      role: 'Pengantin Lelaki',
      fullName: 'Md Nurzakwan Naqiuddin bin Md Haris Fadzillah',
      name: 'Md Nurzakwan Naqiuddin',
      short: 'Naqiuddin',
      initial: 'N',
    },
    bride: {
      role: 'Pengantin Perempuan',
      fullName: 'Norana Syafina binti Abdul Latiff',
      name: 'Norana Syafina',
      short: 'Syafina',
      initial: 'S',
    },
  },

  opening: {
    arabic: 'بِسْمِ ٱللَّٰهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
    latin: 'Bismillahirrahmanirrahim',
  },

  event: {
    title: 'MAJLIS MENGHANTAR BERIAN, AKAD NIKAH & BERSANDING',
    // How the title breaks onto lines in the hero.
    titleLines: ['MAJLIS MENGHANTAR BERIAN', 'AKAD NIKAH & BERSANDING'],
    day: 'Jumaat',
    dateText: '22 Januari 2027',
    hijriDate: '14 Syaaban 1448H', // as provided; not recalculated
    date: '2027-01-22', // ISO date for the countdown and calendar
    // The countdown counts to the start of the guest reception (Menerima Jemputan).
    startTime: '13:15',
    startTimeText: '1:15 PM',
    timeZone: 'Asia/Brunei',
  },

  venue: {
    name: 'DAMAI BALLROOM AMAN HILLS',
    // Display lines; joined with spaces they read exactly as the supplied address.
    addressLines: [
      'Level 3, Aman Hills Hotel, Aman Hills Shopping Centre,',
      "Spg 30, Jalan Aman, Kg Manggis, Mukim Berakas 'B',",
      'Brunei-Muara, BC3615 Bandar Seri Begawan,',
      'Brunei Darussalam.',
    ],
    mapsUrl: '', // optional: paste a Google Maps share link; otherwise a search link is built
    image: 'venue.jpg', // optional photo in src/assets/wedding/
  },

  // In the exact order supplied.
  families: [
    {
      id: 'pihak-lelaki',
      title: 'Pihak Lelaki',
      members: [
        'YM Haji Abdul Hamid bin Haji Kalong',
        'YM Hjh Siti Ara bte Md Tahir',
        'YM Matzin bin Sumil',
        'YM Mariam bte Haji Duraman',
        'YM Md Haris Fadzillah bin Haji Abdul Hamid',
        'YM Norina bte Sumil',
        'YM Haji Zairi bin Sumil @Johari dan Isteri',
        'YM Nor Zetty Akhtar bte Haji Abdul Hamid dan Suami',
        'YM ISNA Putra Md Nursafwan Izzuddin bin Md Haris Fadzillah dan Isteri',
        'YM ISNA Puteri Intan Nur Shakinah bte Md Haris Fadzillah',
        'YM ISNA Putra Md Nurnajwan Azinuddin bin Md Haris Fadzillah',
      ],
    },
    {
      id: 'pihak-perempuan',
      title: 'Pihak Perempuan',
      members: [
        'YM Abdul Latiff bin Haji Abdul Wahab',
        'YM Sarimah binti Awang Zainal',
        'YM Md Syafiq bin Abdul Latiff',
        'YM Nur` Afina binti Haji Marsidi',
        'YM Nur Md Hafizuddin bin Aman',
        'YM Anna Syarina binti Abdul Latiff',
      ],
    },
  ],

  // Atur Cara Majlis — only the confirmed times; the rest are shown as supplied.
  programme: [
    { when: '1:15 PM – 2:15 PM', title: 'Menerima Jemputan' },
    { when: '2:15 PM', title: 'Majlis Menghantar Berian & Akad Nikah', highlight: true },
    { when: 'Seterusnya', title: 'Majlis Bersanding', highlight: true },
    { when: 'Diikuti Dengan', title: 'Bacaan Doa Selamat dan Seterusnya Menikmati Jamuan' },
  ],

  // Placeholder slots only — decorative sample tiles, not photos of the couple
  // or family. Add real files to src/assets/wedding/ to replace them.
  gallery: {
    note: 'Gambar contoh. Gambar majlis akan dikongsi di sini kemudian.',
    photos: [
      { src: 'galeri-01.jpg', alt: 'Gambar contoh: pelamin', caption: 'Pelamin', width: 4, height: 5 },
      { src: 'galeri-02.jpg', alt: 'Gambar contoh: hantaran', caption: 'Hantaran', width: 1, height: 1 },
      { src: 'galeri-03.jpg', alt: 'Gambar contoh: hiasan dewan', caption: 'Hiasan Dewan', width: 3, height: 2 },
      { src: 'galeri-04.jpg', alt: 'Gambar contoh: bunga rampai', caption: 'Bunga Rampai', width: 4, height: 5 },
      { src: 'galeri-05.jpg', alt: 'Gambar contoh: kain songket', caption: 'Songket', width: 3, height: 4 },
      { src: 'galeri-06.jpg', alt: 'Gambar contoh: jamuan', caption: 'Jamuan', width: 3, height: 2 },
    ],
  },

  closing: {
    title: 'Terima Kasih',
    message:
      'Kehadiran serta doa restu para jemputan sekalian amatlah dihargai. Semoga majlis ini diberkati dan dirahmati oleh Allah Subhanahu Wa Ta’ala.',
    signOff: 'Sekian, terima kasih.',
  },

  // Presentation settings.
  presentation: {
    envelope: true, // envelope opening animation on a guest's first visit
    // Navigation, in page order (ids match the sections).
    nav: [
      { id: 'utama', label: 'Utama' },
      { id: 'undangan', label: 'Undangan' },
      { id: 'atur-cara', label: 'Atur Cara' },
      { id: 'tempat', label: 'Tempat' },
      { id: 'galeri', label: 'Galeri' },
    ],
  },
}
