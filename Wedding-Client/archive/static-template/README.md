# Archived: static template sections (not built)

Copies of the generic template sections from before the site was set up for the
22 January 2027 majlis (28 Oct 2026). They were removed from `src/` because this
event's website doesn't use them, and their placeholder couple data must not
appear on the real invitation.

- `components/sections/LoveStory.jsx`, `CoupleProfile.jsx`, `WeddingEvents.jsx`, `Wishes.jsx`
- `components/events/ProgrammeList.jsx`
- `data/weddingData.js`: the placeholder data they read (fictional couple "Hakim & Aisyah")
- `content.js`: the helper library at that time (`programmeRows`, `instagramLink`, `monogram`, …)

To reuse one, copy it back into `src/` and add the matching data to `src/data/weddingData.js`.
