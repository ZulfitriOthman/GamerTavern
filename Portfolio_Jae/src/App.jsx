import { useEffect, useMemo, useState } from 'react'
import PortfolioPage from './page/PortfolioPage'
import AdminPage from './page/AdminPage'
import LoginPage from './page/LoginPage'
import ClientAccessPage from './page/ClientAccessPage'
import ClientWorkspacePage from './page/ClientWorkspacePage'
import { aboutMe, contactInfo } from './page/pageData'
import {
  getAuthUser,
  getAuthToken,
  getPortfolioOverrides,
  isAuthenticated,
  isAdminAuthenticated,
} from './page/portfolioStorage'
import { connectAdminSocket } from './socket/adminSocket'

function App() {
  const [path, setPath] = useState(window.location.pathname || '/')

  const navigate = (nextPath) => {
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath)
    }
    setPath(nextPath)
  }

  useEffect(() => {
    const handlePopState = () => setPath(window.location.pathname || '/')
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    const token = getAuthToken()
    if (token && isAdminAuthenticated()) {
      connectAdminSocket(token)
    }
  }, [])

  const overrides = useMemo(() => getPortfolioOverrides(), [path])
  const mergedAboutMe = { ...aboutMe, ...(overrides.aboutMe || {}) }
  const mergedContactInfo = { ...contactInfo, ...(overrides.contactInfo || {}) }

  if (path === '/login') {
    return <LoginPage onNavigate={navigate} />
  }

  if (path === '/client/access') {
    return <ClientAccessPage onNavigate={navigate} />
  }

  if (path === '/client/portal') {
    if (!isAuthenticated()) {
      return <ClientAccessPage onNavigate={navigate} />
    }

    return <ClientWorkspacePage onNavigate={navigate} user={getAuthUser()} />
  }

  if (path === '/admin') {
    if (!isAdminAuthenticated()) {
      return <LoginPage onNavigate={navigate} />
    }

    return (
      <AdminPage aboutMe={mergedAboutMe} contactInfo={mergedContactInfo} onNavigate={navigate} />
    )
  }

  return (
    <PortfolioPage
      aboutMeOverride={mergedAboutMe}
      contactInfoOverride={mergedContactInfo}
      onNavigate={navigate}
    />
  )
}

export default App
