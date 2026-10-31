import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// A lazily loaded chunk (e.g. the admin dashboard) can fail to load when the
// site was redeployed or the dev server restarted while this tab was open.
// Reload once to pick up the current files; the guard prevents reload loops.
window.addEventListener('vite:preloadError', (event) => {
  try {
    if (sessionStorage.getItem('wedding.chunkReload')) return
    sessionStorage.setItem('wedding.chunkReload', '1')
  } catch {
    return
  }
  event.preventDefault()
  window.location.reload()
})
window.addEventListener('load', () => {
  setTimeout(() => {
    try {
      sessionStorage.removeItem('wedding.chunkReload')
    } catch {
      // storage unavailable — nothing to clear
    }
  }, 10000)
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
