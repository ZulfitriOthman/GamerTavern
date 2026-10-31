// Static one-page invitation. All content comes from src/data/weddingData.js;
// there is no API, database or login.
import { MotionConfig } from 'motion/react'
import { useRef, useState } from 'react'
import { BackgroundMusic } from './components/BackgroundMusic.jsx'
import { Footer } from './components/layout/Footer.jsx'
import { Navbar } from './components/layout/Navbar.jsx'
import { Closing } from './components/sections/Closing.jsx'
import { Countdown } from './components/sections/Countdown.jsx'
import { Envelope } from './components/sections/Envelope.jsx'
import { Families } from './components/sections/Families.jsx'
import { Gallery } from './components/sections/Gallery.jsx'
import { Hero } from './components/sections/Hero.jsx'
import { Programme } from './components/sections/Programme.jsx'
import { Venue } from './components/sections/Venue.jsx'
import { weddingData } from './data/weddingData.js'
import { coupleShort } from './lib/content.js'
import { sessionFlag } from './lib/storage.js'

const ENVELOPE_KEY = 'wedding:envelope-opened'

export default function App() {
  const { event, couple, presentation } = weddingData
  const [showEnvelope, setShowEnvelope] = useState(() => presentation.envelope && !sessionFlag(ENVELOPE_KEY))
  const [opened, setOpened] = useState(!showEnvelope) // the hero animates in as the cover opens

  const music = useRef(null)

  const openEnvelope = ({ skipped } = {}) => {
    sessionFlag(ENVELOPE_KEY, '1')
    setOpened(true)
    if (!skipped) music.current?.play() // "Buka Undangan" starts the music; "Langkau" leaves it off
  }

  return (
    <MotionConfig reducedMotion="user">
      <a href="#main" className="sr-only z-[60] rounded-full bg-ink px-4 py-2 text-ivory focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Langkau ke kandungan
      </a>
      {showEnvelope && <Envelope titleLines={event.titleLines} names={coupleShort(couple)} onOpen={openEnvelope} onDone={() => setShowEnvelope(false)} />}
      <Navbar />
      <main id="main" className="overflow-x-clip">
        <Hero play={opened} />
        <Countdown />
        <Families />
        <Programme />
        <Venue />
        <Gallery />
        <Closing />
      </main>
      <Footer />
      <BackgroundMusic ref={music} />
    </MotionConfig>
  )
}
