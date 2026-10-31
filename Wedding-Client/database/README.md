# Wedding-Client database

This site has its **own** wedding: *Majlis Menghantar Berian, Akad Nikah & Bersanding*, 22 January 2027. Its data must live in its **own MySQL database**. It must never share the database of the Zulfitri & Mariah site (`wedding.nanashicollectibles.com`), or the two weddings' RSVPs, wishes, photos and admin accounts would mix.

The table structure is the same as the other site's, so the schema scripts are reused from `../Wedding/database/migrations/` without changes. Nothing runs automatically: you run every script yourself in MySQL Workbench.

## Setup (once)

1. **Create a new, empty database**, e.g. `nanashi_wedding_majlis2027`, in cPanel → *MySQL Databases*, or locally:
   ```sql
   CREATE DATABASE nanashi_wedding_majlis2027 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
   Create a MySQL user with privileges on **this database only**.
2. **Select it.** In MySQL Workbench, right-click the new database → *Set as Default Schema* (it turns bold). The scripts contain no `USE` statement, so check this before every run.
3. **Run the schema.** Open and execute every file in `../Wedding/database/migrations/`, in order `000` → `011`. Each row in the Output panel should get a green tick.
4. **Run this site's content.** Open and execute **`seeds/001_majlis_22_januari_2027.sql`**. It adds:
   - **`wedding_settings`:** date 22 Jan 2027, 1.15 pm (Asia/Brunei), Hijri date *14 Syaban 1448 Hijrah*, the invitation heading, and both family lists. The lists are stored in `content.invitation.familyGroups`, one name per line, with a blank line between groups.
   - **`wedding_events`:** the majlis, at *DAMAI BALLROOM AMAN HILLS* with the full address and the four-item *Atur Acara Majlis*.
   - **`wedding_albums`:** *Pengantin*, *Majlis* and *Kenangan Tetamu* (the album that receives guest uploads).

   The script is safe to re-run and never overwrites edits made in `/admin`.

## Check it

```sql
SELECT wedding_date, wedding_time, JSON_EXTRACT(content, '$.hijriDate') AS hijri FROM wedding_settings;
SELECT title, event_date, start_time, venue_name FROM wedding_events;
SELECT slug, title, is_guest_uploads FROM wedding_albums;
```

## Not supplied yet, so left empty and hidden from guests

The couple's names and monogram, hero and couple photos, invitation wording (Bismillah, salam, message, closing), dress code, map link, RSVP deadline, capacity, FAQ, contacts and gift details. Add them in **/admin → Settings / Events**; nothing in the code needs changing.

## Notes on the programme times

Times are stored as 24-hour `HH:MM` and displayed in the invitation style:

| Stored | Shown |
| --- | --- |
| `13:15`–`14:15` Menerima Jemputan | **1.15 – 2.15 Petang** |
| `14:15` Majlis Menghantar Berian & Akad Nikah | **2.15 Petang** |
| `14:15` Majlis Bersanding (same start as the item above) | **2.15 Petang onward** |
| *(no time)* Bacaan Doa Selamat dan seterusnya Menikmati Jamuan | **Seterusnya** |

Items whose title names a ceremony in the event title (*Menghantar Berian*, *Akad Nikah*, *Bersanding*) are highlighted.
