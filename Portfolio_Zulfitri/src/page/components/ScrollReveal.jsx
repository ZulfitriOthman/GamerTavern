import { useEffect, useRef, useState } from 'react'

function ScrollReveal({ children, delay = 0, once = true }) {
  const sectionRef = useRef(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const target = sectionRef.current
    if (!target) {
      return undefined
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          if (once) {
            observer.unobserve(entry.target)
          }
        } else if (!once) {
          setIsVisible(false)
        }
      },
      {
        threshold: 0.15,
        rootMargin: '0px 0px -8% 0px',
      }
    )

    observer.observe(target)

    return () => observer.disconnect()
  }, [once])

  return (
    <div
      className={`scroll-reveal${isVisible ? ' is-visible' : ''}`}
      ref={sectionRef}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

export default ScrollReveal