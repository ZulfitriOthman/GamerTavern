-- =============================================================================
-- Seed 001 · Majlis Menghantar Berian, Akad Nikah & Bersanding — 22 January 2027
--
-- For the Wedding-Client site ONLY. Run it in this site's OWN database — never
-- in the Zulfitri & Mariah database used by wedding.nanashicollectibles.com.
-- See ../README.md for the full setup order (schema migrations first).
--
-- Names, titles, spelling and capitalisation are reproduced exactly as supplied.
-- In family lists, one name per line; a blank line starts a new group of names.
--
-- Deliberately LEFT EMPTY (not supplied — fill in later via /admin → Settings;
-- empty fields are hidden from guests):
--   * the couple's names, monogram, hero photo, story
--   * invitation wording (Bismillah, salam, message, closing), family heading
--   * dress code, FAQ, contacts, gifts, RSVP deadline, capacity, map link
--
-- Safe to re-run: never overwrites data you have already edited.
--   * settings row: INSERT IGNORE (kept if it already exists)
--   * event: inserted only if no event with this title on 2027-01-22 exists
--   * albums: INSERT IGNORE on the unique slug
-- =============================================================================

START TRANSACTION;

INSERT IGNORE INTO wedding_settings
  (id, wedding_date, wedding_time, timezone, rsvp_mode, rsvp_deadline,
   greetings_enabled, greetings_auto_approve, photo_uploads_enabled, content)
VALUES
  (1, '2027-01-22', '13:15:00', 'Asia/Brunei', 'open', NULL, 1, 0, 1,
'{
  "locale": "ms-BN",
  "hijriDate": "14 Syaban 1448 Hijrah",
  "couple": {
    "partnerOne": "",
    "partnerTwo": "",
    "fullNameOne": "",
    "fullNameTwo": "",
    "monogram": "",
    "hashtag": ""
  },
  "hero": {
    "eyebrow": "",
    "tagline": "",
    "imageUrl": ""
  },
  "invitation": {
    "bismillah": "",
    "salam": "",
    "heading": "MAJLIS MENGHANTAR BERIAN, AKAD NIKAH & BERSANDING",
    "salutation": "",
    "nameNote": "",
    "message": "",
    "conjunction": "",
    "closing": "",
    "familyHeading": "",
    "familyGroups": [
      { "title": "PIHAK LELAKI", "members": "YM Haji Abdul Hamid bin Haji Kalong\\nYM Hjh Siti Ara bte Md Tahir\\nYM Matzin bin Sumil\\nYM Mariam bte Haji Duraman\\nYM Md Haris Fadzillah bin Haji Abdul Hamid\\nYM Norina bte Sumil\\n\\nYM Haji Zairi bin Sumil @Johari dan ISTRI\\nYM Nor Zetty Akhtar bte Haji Abdul Hamid dan SUAMI\\n\\nYM ISNA PUTRA MD NURSAFWAN IZZUDDIN BIN MD HARIS FADZILLAH DAN ISTRI\\n\\nYM ISNA PUTERI INTAN NUR SHAKINAH BTE MD HARIS FADZILLAH\\nYM ISNA PUTRA MD NURNAJWAN AZINUDDIN BIN MD HARIS FADZILLAH" },
      { "title": "PIHAK PEREMPUAN", "members": "YM ABDUL LATIFF BIN HAJI ABDUL WAHAB\\nYM SARIMAH BINTI AWANG ZAINAL\\nYM MD SYAFIQ BIN ABDUL LATIFF\\nYM NUR` AFINA BINTI HAJI MARSIDI\\nYM NUR MD HAFIZUDDIN BIN AMAN\\nYM ANNA SYARINA BINTI ABDUL LATIFF" }
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

-- Programme times are 24-hour HH:MM; the site shows them as e.g. "1.15 – 2.15 Petang".
--   * An item that starts at the same time as the one before it is shown as
--     "… onward" (2.15 Petang onward — Majlis Bersanding).
--   * An item without a time that follows timed items is shown as "Seterusnya".
INSERT INTO wedding_events
  (id, title, description, event_date, start_time, end_time, venue_name, address,
   maps_url, dress_code, programme, rsvp_enabled, capacity, max_party_size,
   is_published, sort_order)
SELECT
  UUID(), 'MAJLIS MENGHANTAR BERIAN, AKAD NIKAH & BERSANDING', NULL, '2027-01-22', '13:15:00', NULL,
  'DAMAI BALLROOM AMAN HILLS',
  'Level 3, Aman Hills Hotel, Aman Hills Shopping Centre,\nSpg 30, Jalan Aman, Kg Manggis, Mukim Berakas ''B'',\nBrunei-Muara, BC3615 Bandar Seri Begawan, Brunei',
  NULL, NULL,
  '[{"time":"13:15","endTime":"14:15","title":"Menerima Jemputan"},{"time":"14:15","endTime":"","title":"Majlis Menghantar Berian & Akad Nikah"},{"time":"14:15","endTime":"","title":"Majlis Bersanding"},{"time":"","endTime":"","title":"Bacaan Doa Selamat dan seterusnya Menikmati Jamuan"}]',
  1, NULL, 4, 1, 10
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM wedding_events
   WHERE title = 'MAJLIS MENGHANTAR BERIAN, AKAD NIKAH & BERSANDING' AND event_date = '2027-01-22'
);

INSERT IGNORE INTO wedding_albums (id, slug, title, description, is_public, is_guest_uploads, sort_order) VALUES
  (UUID(), 'couple',         'Pengantin',      NULL, 1, 0, 10),
  (UUID(), 'majlis',         'Majlis',         NULL, 1, 0, 20),
  (UUID(), 'guest-memories', 'Kenangan Tetamu', 'Gambar yang dikongsi oleh para tetamu.', 1, 1, 30);

COMMIT;
