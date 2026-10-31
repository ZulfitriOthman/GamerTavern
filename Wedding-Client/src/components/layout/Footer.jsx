import { weddingData } from '../../data/weddingData.js'
import { coupleShort } from '../../lib/content.js'
import { GeometricBand } from '../decor/Geometric.jsx'

export function Footer() {
  const { venue, couple, presentation } = weddingData
  return (
    <footer className="bg-paper relative px-4 pt-12 pb-[calc(2rem+env(safe-area-inset-bottom))] text-center">
      <GeometricBand className="absolute inset-x-0 top-0 -translate-y-1/2" />
      <nav aria-label="Pautan bawah" className="mx-auto flex max-w-2xl flex-wrap justify-center gap-x-7 gap-y-3 font-display text-[0.7rem] tracking-[0.22em] text-muted uppercase">
        {presentation.nav.map((item) => (
          <a key={item.id} href={`#${item.id}`} className="py-1 transition hover:text-primary">
            {item.label}
          </a>
        ))}
      </nav>
      <p className="mt-7 font-serif text-xl text-primary italic">{coupleShort(couple)}</p>
      <p className="mt-2 text-xs text-muted">{venue.name} · Bandar Seri Begawan, Brunei Darussalam</p>
    </footer>
  )
}
