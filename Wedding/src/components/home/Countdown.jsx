import { useEffect, useState } from 'react'
import { countdownParts, zonedTimeToUtc } from '../../lib/time.js'

export function Countdown({ date, time, timeZone, className = '' }) {
  const target = zonedTimeToUtc(date, time ?? '00:00', timeZone)
  const targetMs = target?.getTime() ?? null
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (targetMs === null) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [targetMs])

  if (!target) return null
  const diff = target.getTime() - now
  if (diff <= 0) {
    const daysAfter = Math.floor(-diff / 86400000)
    return (
      <p className={`font-serif text-2xl text-ink italic sm:text-3xl ${className}`}>
        {daysAfter < 1 ? 'Today is the day!' : 'Happily married'}
      </p>
    )
  }

  const parts = countdownParts(diff)
  const units = [
    ['days', 'Days'],
    ['hours', 'Hours'],
    ['minutes', 'Minutes'],
    ['seconds', 'Seconds'],
  ]
  return (
    <div className={`flex justify-center gap-2.5 sm:gap-4 ${className}`} role="timer" aria-label={`${parts.days} days, ${parts.hours} hours and ${parts.minutes} minutes to go`}>
      {units.map(([key, label]) => (
        <div key={key} className="flex w-[4.5rem] flex-col items-center rounded-2xl border border-champagne bg-white/60 py-3 backdrop-blur sm:w-24 sm:py-4" aria-hidden="true">
          <span className="font-serif text-3xl leading-none text-ink tabular-nums sm:text-5xl">{String(parts[key]).padStart(2, '0')}</span>
          <span className="mt-1.5 text-[0.75rem] font-semibold tracking-[0.1em] text-muted uppercase sm:text-[0.8125rem]">{label}</span>
        </div>
      ))}
    </div>
  )
}
