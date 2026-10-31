import { weddingData } from '../../data/weddingData.js'

// Navigation links come from weddingData.presentation.nav (in page order).
export const NAV_ITEMS = weddingData.presentation.nav.map(({ id, label }) => ({ href: `#${id}`, label }))

// Every section the scroll-spy watches, in page order (including ones without a top-level link).
export const SECTION_IDS = ['utama', 'countdown', 'undangan', 'atur-cara', 'tempat', 'galeri', 'penutup']
