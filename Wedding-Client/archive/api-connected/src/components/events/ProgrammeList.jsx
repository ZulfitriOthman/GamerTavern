import { programmeRows } from '../../lib/content.js'

/**
 * The programme ("Atur Acara Majlis") as a time | activity timeline.
 * Ceremonies named in the event title are emphasised (see programmeRows).
 */
export function ProgrammeList({ event, locale }) {
  const rows = programmeRows(event, locale)
  if (!rows.length) return null
  return (
    <ol className="text-left">
      {rows.map((row, i) => (
        <li key={i} className="grid grid-cols-[6.5rem_1fr] gap-4 py-3 sm:grid-cols-[9rem_1fr] sm:gap-5">
          <span className={`pt-0.5 text-right text-[0.78rem] leading-snug font-medium tabular-nums ${row.when ? 'text-gold-deep' : 'text-transparent'}`}>{row.when || '·'}</span>
          <span className={`relative border-l pl-4 sm:pl-5 ${row.highlight ? 'border-gold' : 'border-linen'}`}>
            <span className={`absolute top-[0.45rem] -left-[4.5px] size-2 rotate-45 ${row.highlight ? 'bg-gold' : 'border border-sand bg-white'}`} aria-hidden="true" />
            <span className={row.highlight ? 'font-display text-[1.05rem] leading-snug tracking-[0.04em] text-ink' : 'text-[0.95rem] leading-relaxed text-ink/80'}>{row.title}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}
