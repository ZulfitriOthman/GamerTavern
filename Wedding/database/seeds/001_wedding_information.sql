-- =============================================================================
-- Seed 001 · Official wedding information
--
-- Source: the official invitation "Undangan perkahwinann 2027 - Copy.pdf".
-- Wording, names, titles and spelling are reproduced from the invitation.
--
-- Deliberately LEFT EMPTY (not stated on the invitation — fill in later via
-- /admin/settings and /admin/events; empty fields are hidden from guests):
--   * relationship story / timeline, couple photos, hero photo
--   * dress code, FAQ, contact people, gift details, travel/parking notes
--   * RSVP deadline, event capacity, end time of the majlis
--   * times for programme items after 2:30 PM (none are given)
--
-- Safe to re-run: it never overwrites data you have already edited.
--   * settings row: INSERT IGNORE (kept if it already exists)
--   * event: inserted only if no 'Majlis Bersanding' on 2027-01-01 exists
--   * albums: INSERT IGNORE on the unique slug
--
-- Run AFTER all files in database/migrations/.
-- =============================================================================

START TRANSACTION;

INSERT IGNORE INTO wedding_settings
  (id, wedding_date, wedding_time, timezone, rsvp_mode, rsvp_deadline,
   greetings_enabled, greetings_auto_approve, photo_uploads_enabled, content)
VALUES
  (1, '2027-01-01', '13:45:00', 'Asia/Brunei', 'open', NULL, 1, 0, 1,
'{
  "locale": "ms-BN",
  "hijriDate": "22 Rejab 1448",
  "couple": {
    "partnerOne": "Zulfitri",
    "partnerTwo": "Mariah",
    "fullNameOne": "Awang Muhammad Zulfitri Bin Othman",
    "fullNameTwo": "Dayang Siti Mariah Binti Abdullah @ Md Yusof",
    "monogram": "ZM",
    "hashtag": ""
  },
  "hero": {
    "eyebrow": "Undangan Majlis Bersanding",
    "tagline": "",
    "imageUrl": ""
  },
  "invitation": {
    "bismillah": "بِسْمِ ٱللَّٰهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ",
    "salam": "السَّلاَمُ عَلَيْكُمْ وَرَحْمَةُ اللهِ وَبَرَكَاتُهُ",
    "heading": "Undangan Majlis Bersanding",
    "salutation": "Yang Mulia",
    "nameNote": "Mohon maaf jika terdapat kesilapan dalam penulisan nama dan gelaran",
    "message": "Dengan penuh hormat dan takzim sukacita menjunjung Pengiran berangkat/Mempersilakan Pehin/Dato/Datin/Awang dan Dayang hadir ke Majlis Bersanding anak peramba/kaola kami:",
    "conjunction": "Dengan",
    "closing": "Di atas kesudian keberangkatan Pengiran dan kehadiran Pehin/Dato/Datin/Awang dan Dayang ke majlis ini terlebih dahulu abis peramba / kaola kami serta ahli keluarga dengan tulus ikhlas ingin menyembahkan / mengucapkan setinggi-tinggi penghargaan dan ribuan terima kasih serta bertawakkal pada Allah Subhanahu Wata’ala.",
    "familyHeading": "Yang Berharap",
    "familyGroups": [
      { "title": "Keluarga Pengantin Lelaki", "members": "Awg Othman Bin Haji Ismail\\nDyg Noorhana Binti Haji Abd Rahman (Isteri)\\nAwg Abd Hamid Bin Othman\\nDyg Amal Saleha Binti Othman\\nAwg Md Nur Aminuddin Bin Othman\\nDyg Nurani Binti Othman\\nAwg Ahmad Amirudin Bin Othman" },
      { "title": "Keluarga Pengantin Perempuan", "members": "Awg Mohd Yusof Bin Haji Mohd Daud\\nDyg Nur Qisthina Binti Abdul Rahman(Isteri)\\nAwg Mohd Hidayat Bin Mohd Yusof\\nDyg Hayati Binti Mohd Yusof\\nAwg Mohd Syafie’e Bin Mohd Yusof\\nDyg Siti Nur Aisyah Binti Mohd Yusof" }
    ]
  },
  "story": {
    "intro": "",
    "howWeMet": { "title": "", "text": "", "imageUrl": "" },
    "timeline": []
  },
  "info": {
    "scheduleNote": "",
    "dressCodeNote": "",
    "travelNote": "",
    "faq": [],
    "contacts": [],
    "gifts": { "enabled": false, "message": "", "bankName": "", "accountName": "", "accountNumber": "" }
  },
  "sections": {
    "countdown": true,
    "envelope": true,
    "story": false,
    "events": true,
    "gallery": true,
    "info": true
  },
  "footer": { "message": "" }
}');

INSERT INTO wedding_events
  (id, title, description, event_date, start_time, end_time, venue_name, address,
   maps_url, dress_code, programme, rsvp_enabled, capacity, max_party_size,
   is_published, sort_order)
SELECT
  UUID(), 'Majlis Bersanding', NULL, '2027-01-01', '13:45:00', NULL,
  'Masjid Suri Seri Begawan Raja Pengiran Anak Damit',
  'Kampung Madang, Brunei Darussalam',
  NULL, NULL,
  '[{"time":"13:45","endTime":"14:45","title":"Menerima Jemputan"},{"time":"14:45","endTime":"","title":"Majlis Menghantar Berian Dan Mas Kahwin"},{"time":"","endTime":"","title":"Majlis Akad Nikah"},{"time":"","endTime":"","title":"Bersanding"},{"time":"","endTime":"","title":"Membaca Doa Selamat"},{"time":"","endTime":"","title":"Menikmati Jamuan"}]',
  1, NULL, 4, 1, 10
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM wedding_events WHERE title = 'Majlis Bersanding' AND event_date = '2027-01-01'
);

INSERT IGNORE INTO wedding_albums (id, slug, title, description, is_public, is_guest_uploads, sort_order) VALUES
  (UUID(), 'couple',         'The Couple',     NULL, 1, 0, 10),
  (UUID(), 'pre-wedding',    'Pre-Wedding',    NULL, 1, 0, 20),
  (UUID(), 'ceremony',       'Majlis',         NULL, 1, 0, 30),
  (UUID(), 'guest-memories', 'Guest Memories', 'Photos shared by our guests.', 1, 1, 40);

COMMIT;
