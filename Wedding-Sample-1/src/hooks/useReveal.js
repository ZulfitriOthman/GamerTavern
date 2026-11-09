import { createContext, useContext, useEffect, useRef, useState } from 'react'

// False while the cover is closed, so nothing hidden behind it reveals early.
export const RevealContext = createContext(true)

// Returns [ref, visible]. Becomes visible once, the first time the element
// enters (or has already been scrolled past) the viewport. `immediate` skips
// the observer for first-screen content that should appear as soon as active.
export default function useReveal({ immediate = false } = {}) {
  const active = useContext(RevealContext)
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!active || visible) return
    const node = ref.current

    // No observer support: show content rather than leave it hidden.
    if (immediate || !node || typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting || entry.boundingClientRect.top < 0) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [active, visible, immediate])

  return [ref, visible]
}
