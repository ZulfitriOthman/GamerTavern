import { MotionConfig } from 'motion/react'
import { lazy, Suspense } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { PublicLayout } from './components/layout/PublicLayout.jsx'
import { RouteError } from './components/layout/RouteError.jsx'
import { Spinner } from './components/ui/Feedback.jsx'
import { SiteProvider } from './context/SiteContext.jsx'
import EventsPage from './pages/EventsPage.jsx'
import GalleryPage from './pages/GalleryPage.jsx'
import HomePage from './pages/HomePage.jsx'
import InfoPage from './pages/InfoPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import RsvpPage from './pages/RsvpPage.jsx'
import SharePage from './pages/SharePage.jsx'
import StoryPage from './pages/StoryPage.jsx'
import WishesPage from './pages/WishesPage.jsx'

// The dashboard is a separate chunk: guests never download it.
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
      { path: 'rsvp/:token', element: <RsvpPage /> }, // personal invitation links
      { path: 'info', element: <InfoPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    path: 'admin/*',
    errorElement: <RouteError />,
    element: (
      <Suspense fallback={<div className="grid min-h-dvh place-items-center"><Spinner label="Loading dashboard" /></div>}>
        <AdminApp />
      </Suspense>
    ),
  },
])

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <SiteProvider>
        <RouterProvider router={router} />
      </SiteProvider>
    </MotionConfig>
  )
}
