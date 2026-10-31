import { MotionConfig } from 'motion/react'
import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { PublicLayout } from './components/layout/PublicLayout.jsx'
import { RouteError } from './components/layout/RouteError.jsx'
import { LoadingBlock } from './components/ui/Feedback.jsx'
import { MusicProvider } from './context/MusicContext.jsx'
import { SiteProvider } from './context/SiteContext.jsx'
import { EventsPage } from './pages/EventsPage.jsx'
import { GalleryPage } from './pages/GalleryPage.jsx'
import { HomePage } from './pages/HomePage.jsx'
import { InfoPage } from './pages/InfoPage.jsx'
import { NotFoundPage } from './pages/NotFoundPage.jsx'
import { RsvpPage } from './pages/RsvpPage.jsx'
import { SharePage } from './pages/SharePage.jsx'
import { StoryPage } from './pages/StoryPage.jsx'
import { WishesPage } from './pages/WishesPage.jsx'

// The admin dashboard is code-split so guests never download it.
const AdminApp = lazy(() => import('./admin/AdminApp.jsx'))

const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'story', element: <StoryPage /> },
      { path: 'events', element: <EventsPage /> },
      { path: 'gallery', element: <GalleryPage /> },
      { path: 'share', element: <SharePage /> },
      { path: 'wishes', element: <WishesPage /> },
      { path: 'rsvp', element: <RsvpPage /> },
      { path: 'rsvp/:token', element: <RsvpPage /> },
      { path: 'info', element: <InfoPage /> },
      { path: 'details', element: <Navigate to="/info" replace /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    path: 'admin/*',
    errorElement: <RouteError />,
    element: (
      <Suspense fallback={<LoadingBlock label="Loading dashboard…" />}>
        <AdminApp />
      </Suspense>
    ),
  },
])

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <SiteProvider>
        {/* One background-music player for the whole visit: outside the router, so page changes never restart it. */}
        <MusicProvider>
          <RouterProvider router={router} />
        </MusicProvider>
      </SiteProvider>
    </MotionConfig>
  )
}
