// All editable invitation text lives here.
// Replace the [bracketed] placeholders once the real details are confirmed.
const invitationData = {
  cover: {
    buttonLabel: 'Buka Jemputan',
  },

  // Background music: "Baraka Allahu Lakuma" by Maher Zain.
  // Place the MP3 at public/audio/baraka-allahu-lakuma.mp3
  music: {
    src: 'audio/Maher Zain - Baraka Allahu Lakuma Lyrics.mp3', // relative to the site base
    volume: 0.35,
    labels: {
      play: 'Mainkan muzik',
      pause: 'Jeda muzik',
    },
  },

  greeting: {
    bismillah: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
    salam: 'Assalamualaikum Warahmatullahi Wabarakatuh',
  },

  title: 'Majlis Malam Berbadak',
  couple: {
    first: 'Awang Muhammad Zulfitri Bin Othman',
    joiner: 'Dengan',
    second: 'Dayang Siti Mariah Binti Abdullah @ Md Yusof',
  },
  invitation:
    'Dengan penuh hormat dan takzim, sukacita menjunjung Pengiran berangkat dan mempersilakan Pehin/Dato/Datin/Awang dan Dayang hadir ke Majlis Malam Berbadak.',
  scrollCue: 'Tatal ke bawah',

  date: {
    label: 'Hari & Tarikh',
    value: 'Khamis, 31 Disember 2026',
  },
  time: {
    label: 'Masa',
    entries: [
      { time: '7.15 – 7.45 malam', activity: 'Ketibaan Tetamu Jemputan' },
      { time: '7.50 malam', activity: 'Majlis Bermula' },
    ],
  },
  venue: {
    label: 'Lokasi Majlis',
    name: 'Restaurant Tiong Jaya',
    floor: 'Tingkat 1',
    latitude: 4.8794375,
    longitude: 114.8590625,
    mapUrl:
      'https://www.google.com/maps/search/?api=1&query=4.8794375,114.8590625',
    mapLabel: 'Buka di Google Maps',
    mapNewTabNote: '(dibuka dalam tab baharu)',
  },

  // Hidden until the Malam Berbadak programme is confirmed
  showProgramme: false,
  programme: {
    label: 'Aturcara Majlis',
    items: [
      { time: '[Masa]', activity: 'Ketibaan para jemputan' },
      { time: '[Masa]', activity: 'Majlis Malam Berbadak bermula' },
      { time: '[Masa]', activity: 'Jamuan makan' },
    ],
  },

  // Hidden until their role as hosts for Malam Berbadak is confirmed
  showFamilySection: false,
  familyTitle: 'Yang Berharap',
  familyNames: [
    'Awg Othman Bin Haji Ismail',
    'Dyg Noorhana Binti Haji Abd Rahman (Isteri)',
    'Awg Abd Hamid Bin Othman',
    'Dyg Amal Saleha Binti Othman',
    'Awg Md Nur Aminuddin Bin Othman',
    'Dyg Nurani Binti Othman',
    'Awg Ahmad Amirudin Bin Othman',
  ],

  closing:
    'Di atas kesudian keberangkatan Pengiran dan kehadiran Pehin/Dato/Datin/Awang dan Dayang ke majlis ini, kami serta ahli keluarga dengan tulus ikhlas menyembahkan dan mengucapkan setinggi-tinggi penghargaan dan ribuan terima kasih serta bertawakkal kepada Allah Subhanahu Wata’ala.',
}

export default invitationData
