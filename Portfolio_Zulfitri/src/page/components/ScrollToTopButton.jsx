import { useEffect, useState } from 'react'

function ScrollToTopButton() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > 420)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <button
      aria-label="Scroll to top"
      className={`fixed bottom-5 right-5 z-40 rounded-full border border-[#f97316]/50 bg-[#1a1a1a] px-3.5 py-2.5 text-[#f97316] shadow-[0_10px_24px_rgba(0,0,0,0.35)] transition-all duration-300 md:bottom-8 md:right-8 ${
        isVisible
          ? 'pointer-events-auto translate-y-0 opacity-100'
          : 'pointer-events-none translate-y-3 opacity-0'
      }`}
      onClick={scrollToTop}
      type="button"
    >
      <span className="block text-lg leading-none">↑</span>
    </button>
  )
}

export default ScrollToTopButton