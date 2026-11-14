import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { AuthProvider } from '@mashoor/shared/AuthProvider'
import '@mashoor/shared/styles.css'
import { api } from './api.js'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider api={api}>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
