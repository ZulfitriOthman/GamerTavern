// Local photo locations. Drop files with these exact names into
// public/images/wedding/ and they appear automatically — no code changes.
//
// Photos uploaded in /admin (hero, couple portraits, story) always take
// priority over these files. When neither exists, every section falls back to
// an elegant photo-free design, so a missing file never shows a broken image.
export const LOCAL_IMAGES = {
  hero: '/images/wedding/hero.jpg', // wide landscape, at least 2000px across
  venue: '/images/wedding/venue.jpg', // the venue, landscape
  partnerOne: '/images/wedding/partner-one.jpg', // portrait, about 4:5
  partnerTwo: '/images/wedding/partner-two.jpg', // portrait, about 4:5
  story: '/images/wedding/story.jpg', // portrait, about 4:5
}
