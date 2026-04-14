import { useState } from 'react'
import { logout, savePortfolioOverrides } from './portfolioStorage'

function AdminPage({ aboutMe, contactInfo, onNavigate }) {
  const [aboutTitle, setAboutTitle] = useState(aboutMe.title)
  const [aboutSummary, setAboutSummary] = useState(aboutMe.summary)
  const [contactEmail, setContactEmail] = useState(contactInfo.email)
  const [subject, setSubject] = useState(contactInfo.subject)
  const [description, setDescription] = useState(contactInfo.description)
  const [hireSubject, setHireSubject] = useState(contactInfo.hireSubject)
  const [hireDescription, setHireDescription] = useState(contactInfo.hireDescription)
  const [status, setStatus] = useState('')

  const handleSave = () => {
    const overrides = {
      aboutMe: {
        title: aboutTitle,
        summary: aboutSummary,
      },
      contactInfo: {
        email: contactEmail,
        subject,
        description,
        hireSubject,
        hireDescription,
      },
    }

    savePortfolioOverrides(overrides)
    setStatus('Saved successfully. Open Portfolio Preview to see updates.')
  }

  const handleLogout = () => {
    logout()
    onNavigate('/login')
  }

  return (
    <main className="mx-auto my-6 w-[min(920px,calc(100%-2rem))] rounded-2xl border border-[#2a2a2a] bg-[#0d0d0d] p-6 shadow-[0_20px_36px_rgba(239,68,68,0.15)] md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#ef4444]">Admin Panel</p>
          <h1 className="mt-2 font-['Syne'] text-3xl text-[#ffffff]">Update Portfolio Content</h1>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-full bg-[#ef4444] px-4 py-2 text-sm font-bold text-[#0d0d0d]"
            onClick={handleSave}
            type="button"
          >
            Save Changes
          </button>
          <button
            className="rounded-full border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-2 text-sm font-bold text-[#ffffff]"
            onClick={() => onNavigate('/')}
            type="button"
          >
            Portfolio Preview
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

      {status && <p className="mt-4 text-sm font-bold text-[#86efac]">{status}</p>}

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="block md:col-span-2">
          <span className="mb-1.5 block text-sm font-bold text-[#ef4444]">About Title</span>
          <input
            className="w-full rounded-xl border border-[#2a2a2a] bg-[#161616] px-4 py-2.5 text-[#ffffff] outline-none focus:border-[#ef4444]/70"
            onChange={(event) => setAboutTitle(event.target.value)}
            type="text"
            value={aboutTitle}
          />
        </label>

        <label className="block md:col-span-2">
          <span className="mb-1.5 block text-sm font-bold text-[#ef4444]">About Summary</span>
          <textarea
            className="min-h-[100px] w-full rounded-xl border border-[#2a2a2a] bg-[#161616] px-4 py-2.5 text-[#ffffff] outline-none focus:border-[#ef4444]/70"
            onChange={(event) => setAboutSummary(event.target.value)}
            value={aboutSummary}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-[#ef4444]">Contact Email</span>
          <input
            className="w-full rounded-xl border border-[#2a2a2a] bg-[#161616] px-4 py-2.5 text-[#ffffff] outline-none focus:border-[#ef4444]/70"
            onChange={(event) => setContactEmail(event.target.value)}
            type="email"
            value={contactEmail}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-[#ef4444]">Project Inquiry Subject</span>
          <input
            className="w-full rounded-xl border border-[#2a2a2a] bg-[#161616] px-4 py-2.5 text-[#ffffff] outline-none focus:border-[#ef4444]/70"
            onChange={(event) => setSubject(event.target.value)}
            type="text"
            value={subject}
          />
        </label>

        <label className="block md:col-span-2">
          <span className="mb-1.5 block text-sm font-bold text-[#ef4444]">Project Inquiry Description</span>
          <textarea
            className="min-h-[110px] w-full rounded-xl border border-[#2a2a2a] bg-[#161616] px-4 py-2.5 text-[#ffffff] outline-none focus:border-[#ef4444]/70"
            onChange={(event) => setDescription(event.target.value)}
            value={description}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-[#ef4444]">Hiring Subject</span>
          <input
            className="w-full rounded-xl border border-[#2a2a2a] bg-[#161616] px-4 py-2.5 text-[#ffffff] outline-none focus:border-[#ef4444]/70"
            onChange={(event) => setHireSubject(event.target.value)}
            type="text"
            value={hireSubject}
          />
        </label>

        <label className="block md:col-span-2">
          <span className="mb-1.5 block text-sm font-bold text-[#ef4444]">Hiring Description</span>
          <textarea
            className="min-h-[110px] w-full rounded-xl border border-[#2a2a2a] bg-[#161616] px-4 py-2.5 text-[#ffffff] outline-none focus:border-[#ef4444]/70"
            onChange={(event) => setHireDescription(event.target.value)}
            value={hireDescription}
          />
        </label>
      </div>

      <p className="mt-5 text-xs text-[#9ca3af]">
        Note: Updates are stored in browser local storage for this template.
      </p>
    </main>
  )
}

export default AdminPage
