import { useEffect, useState } from 'react'
import { fetchClientSubmissions, getAuthUser, logout, submitClientPortfolio } from './portfolioStorage'

function ClientWorkspacePage({ onNavigate }) {
  const [form, setForm] = useState({
    about: '',
    contactEmail: '',
    contactPhone: '',
    fullName: '',
    githubUrl: '',
    linkedinUrl: '',
    notes: '',
    portfolioTitle: '',
    preferredTheme: '',
    tagline: '',
  })
  const [avatar, setAvatar] = useState(null)
  const [gallery, setGallery] = useState([])
  const [documents, setDocuments] = useState([])
  const [status, setStatus] = useState('')
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const user = getAuthUser()

  useEffect(() => {
    let isMounted = true

    fetchClientSubmissions()
      .then((items) => {
        if (isMounted) {
          setSubmissions(items)
        }
      })
      .catch(() => {
        if (isMounted) {
          setStatus('Unable to load previous submissions right now.')
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setStatus('Submitting materials...')

    try {
      const payload = new FormData()

      Object.entries(form).forEach(([key, value]) => payload.append(key, value))

      if (avatar) {
        payload.append('avatar', avatar)
      }

      gallery.forEach((file) => payload.append('gallery', file))
      documents.forEach((file) => payload.append('documents', file))

      const saved = await submitClientPortfolio(payload)
      setSubmissions((current) => [saved, ...current])
      setStatus('Submission received successfully.')
      setAvatar(null)
      setGallery([])
      setDocuments([])
    } catch (e) {
      setStatus(e.message || 'Unable to submit portfolio materials.')
    }
  }

  const handleLogout = () => {
    logout()
    onNavigate('/client/access')
  }

  return (
    <main className="animate-page-fade mx-auto my-6 w-[min(1120px,calc(100%-2rem))] rounded-2xl border border-[#2a2a2a] bg-[#0d0d0d] p-6 shadow-[0_20px_36px_rgba(239,68,68,0.15)] md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#ef4444]">Client Workspace</p>
          <h1 className="mt-2 font-['Syne'] text-3xl text-[#ffffff]">Send Portfolio Content</h1>
          <p className="mt-2 text-sm text-[#9ca3af]">
            Logged in as {user?.NAME || user?.name || user?.EMAIL || user?.email || 'Client'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-full border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-2 text-sm font-bold text-[#ffffff]"
            onClick={() => onNavigate('/')}
            type="button"
          >
            View Portfolio
          </button>
          <button
            className="rounded-full border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-2 text-sm font-bold text-[#ffffff]"
            onClick={handleLogout}
            type="button"
          >
            Logout
          </button>
        </div>
      </div>

      {status && <p className="mt-4 text-sm font-bold text-[#9ca3af]">{status}</p>}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-sm font-bold text-[#ef4444]">Full Name</span>
            <input className="w-full rounded-xl border border-[#2a2a2a] bg-[#161616] px-4 py-2.5 text-[#ffffff] outline-none focus:border-[#ef4444]/70" onChange={(event) => updateField('fullName', event.target.value)} type="text" value={form.fullName} />
          </label>

          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-sm font-bold text-[#ef4444]">Portfolio Title</span>
            <input className="w-full rounded-xl border border-[#2a2a2a] bg-[#161616] px-4 py-2.5 text-[#ffffff] outline-none focus:border-[#ef4444]/70" onChange={(event) => updateField('portfolioTitle', event.target.value)} type="text" value={form.portfolioTitle} />
          </label>

          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-sm font-bold text-[#ef4444]">Tagline</span>
            <input className="w-full rounded-xl border border-[#2a2a2a] bg-[#161616] px-4 py-2.5 text-[#ffffff] outline-none focus:border-[#ef4444]/70" onChange={(event) => updateField('tagline', event.target.value)} type="text" value={form.tagline} />
          </label>

          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-sm font-bold text-[#ef4444]">About</span>
            <textarea className="min-h-[120px] w-full rounded-xl border border-[#2a2a2a] bg-[#161616] px-4 py-2.5 text-[#ffffff] outline-none focus:border-[#ef4444]/70" onChange={(event) => updateField('about', event.target.value)} value={form.about} />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-[#ef4444]">Contact Email</span>
            <input className="w-full rounded-xl border border-[#2a2a2a] bg-[#161616] px-4 py-2.5 text-[#ffffff] outline-none focus:border-[#ef4444]/70" onChange={(event) => updateField('contactEmail', event.target.value)} type="email" value={form.contactEmail} />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-[#ef4444]">Contact Phone</span>
            <input className="w-full rounded-xl border border-[#2a2a2a] bg-[#161616] px-4 py-2.5 text-[#ffffff] outline-none focus:border-[#ef4444]/70" onChange={(event) => updateField('contactPhone', event.target.value)} type="text" value={form.contactPhone} />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-[#ef4444]">LinkedIn URL</span>
            <input className="w-full rounded-xl border border-[#2a2a2a] bg-[#161616] px-4 py-2.5 text-[#ffffff] outline-none focus:border-[#ef4444]/70" onChange={(event) => updateField('linkedinUrl', event.target.value)} type="url" value={form.linkedinUrl} />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-[#ef4444]">GitHub / Portfolio URL</span>
            <input className="w-full rounded-xl border border-[#2a2a2a] bg-[#161616] px-4 py-2.5 text-[#ffffff] outline-none focus:border-[#ef4444]/70" onChange={(event) => updateField('githubUrl', event.target.value)} type="url" value={form.githubUrl} />
          </label>

          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-sm font-bold text-[#ef4444]">Preferred Theme</span>
            <input className="w-full rounded-xl border border-[#2a2a2a] bg-[#161616] px-4 py-2.5 text-[#ffffff] outline-none focus:border-[#ef4444]/70" onChange={(event) => updateField('preferredTheme', event.target.value)} placeholder="Example: black and red, clean minimal, editorial" type="text" value={form.preferredTheme} />
          </label>

          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-sm font-bold text-[#ef4444]">Extra Notes</span>
            <textarea className="min-h-[120px] w-full rounded-xl border border-[#2a2a2a] bg-[#161616] px-4 py-2.5 text-[#ffffff] outline-none focus:border-[#ef4444]/70" onChange={(event) => updateField('notes', event.target.value)} value={form.notes} />
          </label>

          <div className="md:col-span-2 flex flex-wrap gap-3 pt-2">
            <button className="rounded-full bg-[#ef4444] px-5 py-2.5 text-sm font-bold text-[#0d0d0d]" type="submit">
              Submit Portfolio Materials
            </button>
          </div>
        </form>

        <aside className="space-y-4">
          <section className="rounded-xl border border-[#2a2a2a] bg-[#161616] p-4">
            <h2 className="font-['Syne'] text-lg text-[#ffffff]">Upload Files</h2>

            <label className="mt-4 block">
              <span className="mb-1.5 block text-sm font-bold text-[#ef4444]">Profile Image</span>
              <input className="block w-full text-sm text-[#9ca3af]" onChange={(event) => setAvatar(event.target.files?.[0] || null)} type="file" accept="image/*" />
            </label>

            <label className="mt-4 block">
              <span className="mb-1.5 block text-sm font-bold text-[#ef4444]">Gallery Images</span>
              <input className="block w-full text-sm text-[#9ca3af]" onChange={(event) => setGallery(Array.from(event.target.files || []))} type="file" accept="image/*" multiple />
            </label>

            <label className="mt-4 block">
              <span className="mb-1.5 block text-sm font-bold text-[#ef4444]">Documents</span>
              <input className="block w-full text-sm text-[#9ca3af]" onChange={(event) => setDocuments(Array.from(event.target.files || []))} type="file" accept=".pdf,.doc,.docx,.txt,image/*" multiple />
            </label>
          </section>

          <section className="rounded-xl border border-[#2a2a2a] bg-[#161616] p-4">
            <h2 className="font-['Syne'] text-lg text-[#ffffff]">Recent Submissions</h2>

            {loading ? (
              <p className="mt-3 text-sm text-[#9ca3af]">Loading submissions...</p>
            ) : submissions.length === 0 ? (
              <p className="mt-3 text-sm text-[#9ca3af]">No submissions yet.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {submissions.map((item) => (
                  <article className="rounded-xl border border-[#2a2a2a] bg-[#101010] p-3" key={item.id}>
                    <p className="text-sm font-bold text-[#ffffff]">{item.content?.portfolioTitle || item.content?.fullName || 'Untitled submission'}</p>
                    <p className="mt-1 text-xs text-[#9ca3af]">{new Date(item.createdAt).toLocaleString()}</p>
                    <p className="mt-2 text-xs text-[#ef4444]">
                      Files: {(item.files?.avatar?.length || 0) + (item.files?.gallery?.length || 0) + (item.files?.documents?.length || 0)}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>
    </main>
  )
}

export default ClientWorkspacePage
