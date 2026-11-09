import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import invitationData from './invitationData'
import cornerBouquet from './assets/florals/corner-bouquet.svg'
import CoupleNames from './components/CoupleNames'
import Divider from './components/Divider'
import FloatingPetals from './components/FloatingPetals'
import GoldCrest from './components/GoldCrest'
import InvitationCover from './components/InvitationCover'
import MusicToggle from './components/MusicToggle'
import RevealSection from './components/RevealSection'
import { RevealContext } from './hooks/useReveal'
import './App.css'

// Matches the cover panel transition (0.1s delay + 1.1s) plus a small buffer.
const OPENING_MS = 1300

const icons = {
  calendar: (
    <>
      <rect x="4" y="5.5" width="16" height="14.5" rx="2" />
      <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  location: (
    <>
      <path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.4" />
    </>
  ),
}

// Lets text wrap only after commas, e.g. "Khamis," / "31 Disember 2026".
function BreakAfterCommas({ text }) {
  const parts = text.split(', ')
  // The space stays outside the spans so it remains a break opportunity.
  return parts.map((part, index) => (
    <Fragment key={index}>
      {index > 0 && ' '}
      <span className="nowrap">
        {part}
        {index < parts.length - 1 && ','}
      </span>
    </Fragment>
  ))
}

// Corner bouquet artwork, mirrored per corner via CSS.
function Bouquet({ corner, className = '' }) {
  return (
    <img
      className={`bouquet bouquet--${corner} ${className}`}
      src={cornerBouquet}
      alt=""
    />
  )
}

function DetailItem({ icon, label, delay, children }) {
  return (
    <RevealSection className="detail" delay={delay}>
      <span className="detail__icon" aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          focusable="false"
        >
          {icons[icon]}
        </svg>
      </span>
      <h2 className="detail__label">{label}</h2>
      {children}
    </RevealSection>
  )
}

function App() {
  const {
    cover,
    music,
    greeting,
    title,
    couple,
    invitation,
    scrollCue,
    date,
    time,
    venue,
    showProgramme,
    programme,
    showFamilySection,
    familyTitle,
    familyNames,
    closing,
  } = invitationData

  // closed → opening (cover animating away) → open (cover unmounted)
  const [phase, setPhase] = useState('closed')
  const headingRef = useRef(null)
  const isClosed = phase === 'closed'
  const coverMounted = phase !== 'open'

  // Background music lives here so it survives the cover unmounting.
  const audioRef = useRef(null)
  const [musicPlaying, setMusicPlaying] = useState(false)
  const [musicAvailable, setMusicAvailable] = useState(true)

  // Starts (or resumes) playback. Must be called straight from a tap/click
  // so mobile browsers treat it as user-initiated. Failure is non-fatal.
  const playMusic = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = music.volume // ignored on iOS, where volume is hardware-only
    const attempt = audio.play()
    attempt?.catch(() => {
      if (audio.error) setMusicAvailable(false)
      setMusicPlaying(false)
    })
  }, [music.volume])

  const toggleMusic = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) playMusic()
    else audio.pause() // keeps currentTime, so resume continues in place
  }, [playMusic])

  const handleOpen = useCallback(() => {
    // Synchronously, before any state change or timer.
    playMusic()

    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    setPhase(reduceMotion ? 'open' : 'opening')
  }, [playMusic])

  // Always start at the top, behind the cover, on a fresh load.
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }
    window.scrollTo(0, 0)
  }, [])

  // Keep the page still while the cover is up.
  useEffect(() => {
    if (!coverMounted) return
    const root = document.documentElement
    root.classList.add('is-scroll-locked')
    return () => root.classList.remove('is-scroll-locked')
  }, [coverMounted])

  useEffect(() => {
    if (phase !== 'opening') return
    const timer = window.setTimeout(() => setPhase('open'), OPENING_MS)
    return () => window.clearTimeout(timer)
  }, [phase])

  // Hand keyboard focus to the invitation once it is no longer inert.
  useEffect(() => {
    if (!isClosed) headingRef.current?.focus({ preventScroll: true })
  }, [isClosed])

  return (
    <>
      {/* preload="none": nothing is fetched or played until the guest taps. */}
      <audio
        ref={audioRef}
        src={`${import.meta.env.BASE_URL}${music.src}`}
        preload="none"
        loop
        onPlay={() => setMusicPlaying(true)}
        onPause={() => setMusicPlaying(false)}
        onError={() => {
          setMusicAvailable(false)
          setMusicPlaying(false)
        }}
      />

      {!isClosed && musicAvailable && (
        <MusicToggle
          playing={musicPlaying}
          labels={music.labels}
          onToggle={toggleMusic}
        />
      )}

      {coverMounted && (
        <InvitationCover
          title={title}
          couple={couple}
          date={date.value}
          venue={venue.name}
          buttonLabel={cover.buttonLabel}
          opening={phase === 'opening'}
          onOpen={handleOpen}
        />
      )}

      <RevealContext.Provider value={!isClosed}>
        <main className={`site${isClosed ? ' is-pending' : ''}`} inert={isClosed}>
          <FloatingPetals />

          {/* Hero ---------------------------------------------------------- */}
          <section className="hero">
            <div className="hero__frame" aria-hidden="true" />
            <Bouquet corner="tl" className="hero__bouquet" />
            <Bouquet corner="tr" className="hero__bouquet" />
            <Bouquet corner="bl" className="hero__bouquet hero__bouquet--small" />
            <Bouquet corner="br" className="hero__bouquet hero__bouquet--small" />

            <div className="hero__content">
              <RevealSection immediate delay={150} className="greeting">
                <p className="greeting__bismillah" lang="ar" dir="rtl">
                  {greeting.bismillah}
                </p>
                <p className="greeting__salam">{greeting.salam}</p>
              </RevealSection>
              <RevealSection immediate delay={250}>
                <GoldCrest className="hero__crest" />
              </RevealSection>
              <RevealSection immediate delay={350}>
                <h1 className="hero__title" ref={headingRef} tabIndex={-1}>
                  {title}
                </h1>
              </RevealSection>
              <Divider immediate delay={500} />
              <RevealSection immediate delay={600}>
                <CoupleNames couple={couple} className="hero__names" />
              </RevealSection>
              <RevealSection immediate delay={750}>
                <p className="hero__text">{invitation}</p>
              </RevealSection>
            </div>

            <RevealSection className="hero__cue-wrap" immediate delay={850}>
              <a className="hero__cue" href="#butiran">
                <span>{scrollCue}</span>
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path
                    d="M6 9l6 6 6-6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
            </RevealSection>
          </section>

          {/* Event details ------------------------------------------------- */}
          <section className="details" id="butiran">
            <div className="container">
              <div className="details__grid">
                <DetailItem icon="calendar" label={date.label}>
                  <p className="detail__value">
                    <BreakAfterCommas text={date.value} />
                  </p>
                </DetailItem>
                <DetailItem icon="clock" label={time.label} delay={150}>
                  <ul className="detail__schedule">
                    {time.entries.map((entry) => (
                      <li className="detail__entry" key={entry.time}>
                        <p className="detail__value">{entry.time}</p>
                        <p className="detail__sub">{entry.activity}</p>
                      </li>
                    ))}
                  </ul>
                </DetailItem>
                <DetailItem icon="location" label={venue.label} delay={300}>
                  <p className="detail__value">{venue.name}</p>
                  <p className="detail__sub">{venue.floor}</p>
                  <a
                    className="map-link"
                    href={venue.mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      focusable="false"
                    >
                      {icons.location}
                    </svg>
                    {venue.mapLabel}
                    <span className="visually-hidden"> {venue.mapNewTabNote}</span>
                  </a>
                </DetailItem>
              </div>
            </div>
          </section>

          {/* Aturcara ------------------------------------------------------ */}
          {showProgramme && (
            <section className="programme">
              <div className="container">
                <RevealSection>
                  <h2 className="section-title">{programme.label}</h2>
                </RevealSection>
                <Divider delay={150} />
                <ol className="timeline">
                  {programme.items.map((item, index) => (
                    <RevealSection
                      as="li"
                      className="timeline__item"
                      delay={index * 150}
                      key={index}
                    >
                      <span className="timeline__time">{item.time}</span>
                      <span className="timeline__marker" aria-hidden="true" />
                      <span className="timeline__activity">{item.activity}</span>
                    </RevealSection>
                  ))}
                </ol>
              </div>
            </section>
          )}

          {/* Yang Berharap ------------------------------------------------- */}
          {showFamilySection && (
            <section className="family">
              <div className="container">
                <RevealSection>
                  <h2 className="section-title">{familyTitle}</h2>
                </RevealSection>
                <Divider delay={150} />
                <RevealSection as="ul" className="family__list">
                  {familyNames.map((familyName) => (
                    <li key={familyName}>{familyName}</li>
                  ))}
                </RevealSection>
              </div>
            </section>
          )}

          {/* Closing ------------------------------------------------------- */}
          <section className="closing">
            <Bouquet corner="bl" className="closing__bouquet" />
            <Bouquet corner="br" className="closing__bouquet" />
            <div className="container closing__content">
              <Divider />
              <RevealSection>
                <p className="closing__text">{closing}</p>
              </RevealSection>
              <RevealSection className="closing__flourish" delay={300}>
                <GoldCrest />
              </RevealSection>
            </div>
          </section>
        </main>
      </RevealContext.Provider>
    </>
  )
}

export default App
