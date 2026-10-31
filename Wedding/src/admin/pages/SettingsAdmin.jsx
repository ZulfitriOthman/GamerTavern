import { Check, Copy, Download, Save } from 'lucide-react'
import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { LoadingBlock, Notice } from '../../components/ui/Feedback.jsx'
import { defaultContent, defaultSettings } from '../../config/defaultContent.js'
import { useSite } from '../../context/SiteContext.jsx'
import { friendlyError } from '../../lib/errors.js'
import { familyGroupsOf } from '../../lib/family.js'
import { deepMerge } from '../../lib/merge.js'
import { siteUrl } from '../../lib/siteUrl.js'
import { useAsync } from '../../hooks/useAsync.js'
import { fetchSettings, saveSettings } from '../../services/adminService.js'
import { AdminHeader } from '../components/AdminLayout.jsx'
import { ImageField, ListEditor, Toggle, useAction } from '../components/shared.jsx'

const COLUMN_KEYS = Object.keys(defaultSettings)

function Section({ title, description, children }) {
  return (
    <section className="rounded-3xl border border-champagne bg-white/60 p-5 sm:p-7">
      <h2 className="text-2xl">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  )
}

function Text({ label, value, onChange, textarea, hint, ...rest }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {textarea ? (
        <textarea rows={4} className="field-input" value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest} />
      ) : (
        <input className="field-input" value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest} />
      )}
      {hint && <span className="field-hint block">{hint}</span>}
    </label>
  )
}

export function SettingsAdmin() {
  const { data, error, loading } = useAsync(fetchSettings, [])
  if (loading) return <LoadingBlock />
  if (error) return <Notice tone="error">{friendlyError(error)}</Notice>
  if (!data)
    return (
      <Notice tone="warning" title="Settings row missing">
        Run <code>database/seeds/001_wedding_information.sql</code> in MySQL Workbench, then reload.
      </Notice>
    )
  return <SettingsForm initial={data} />
}

function SettingsForm({ initial }) {
  const { refresh } = useSite()
  const { busy, run, feedback } = useAction()
  const [cols, setCols] = useState(() => Object.fromEntries(COLUMN_KEYS.map((k) => [k, initial[k] ?? defaultSettings[k]])))
  const [content, setContent] = useState(() => {
    const merged = deepMerge(defaultContent, initial.content ?? {})
    // Family groups exactly as stored in MySQL ([] if none yet).
    return { ...merged, invitation: { ...merged.invitation, familyGroups: familyGroupsOf(merged.invitation) } }
  })
  const [dirty, setDirty] = useState(false)

  const setCol = (key) => (value) => {
    setCols((c) => ({ ...c, [key]: value }))
    setDirty(true)
  }
  /** Updates a nested content value by path, e.g. setAt('couple.partnerOne'). */
  const setAt = (path) => (value) => {
    setContent((c) => {
      const keys = path.split('.')
      const next = structuredClone(c)
      let obj = next
      keys.slice(0, -1).forEach((k) => (obj = obj[k]))
      obj[keys.at(-1)] = value
      return next
    })
    setDirty(true)
  }

  const save = async () => {
    const patch = {
      ...cols,
      wedding_date: cols.wedding_date || null,
      wedding_time: cols.wedding_time || null,
      rsvp_deadline: cols.rsvp_deadline || null,
      timezone: cols.timezone?.trim() || 'Asia/Kuala_Lumpur',
      content,
    }
    try {
      new Intl.DateTimeFormat('en', { timeZone: patch.timezone })
    } catch {
      return run(() => Promise.reject(new Error(`“${patch.timezone}” is not a valid time zone (e.g. Asia/Kuala_Lumpur).`)))
    }
    const res = await run(() => saveSettings(patch), 'Settings saved — your website has been updated.')
    if (res) {
      setDirty(false)
      refresh()
    }
  }

  const c = content
  return (
    <>
      <AdminHeader title="Settings" description="Everything guests see on the website.">
        <button type="button" className="btn-primary btn-sm" onClick={save} disabled={busy || !dirty}>
          <Save className="size-4" /> {busy ? 'Saving…' : 'Save changes'}
        </button>
      </AdminHeader>
      {feedback}

      <div className="space-y-5 pb-24">
        <Section title="Couple & date" description="Names and wording are shown exactly as typed.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Text label="Short name — groom" value={c.couple.partnerOne} onChange={setAt('couple.partnerOne')} maxLength={60} />
            <Text label="Short name — bride" value={c.couple.partnerTwo} onChange={setAt('couple.partnerTwo')} maxLength={60} />
            <Text label="Full name — groom" value={c.couple.fullNameOne} onChange={setAt('couple.fullNameOne')} maxLength={150} />
            <Text label="Full name — bride" value={c.couple.fullNameTwo} onChange={setAt('couple.fullNameTwo')} maxLength={150} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Text label="Wedding date" type="date" value={cols.wedding_date} onChange={setCol('wedding_date')} />
            <Text label="Time (for countdown)" type="time" value={cols.wedding_time?.slice(0, 5)} onChange={setCol('wedding_time')} />
            <Text label="Time zone" value={cols.timezone} onChange={setCol('timezone')} hint="IANA name, e.g. Asia/Brunei" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Text label="Hijri date" value={c.hijriDate} onChange={setAt('hijriDate')} maxLength={60} placeholder="e.g. 22 Rejab 1448" />
            <Text label="Monogram letters" value={c.couple.monogram} onChange={setAt('couple.monogram')} maxLength={3} />
            <Text label="Hashtag" value={c.couple.hashtag} onChange={setAt('couple.hashtag')} maxLength={60} placeholder="Optional" />
            <Text label="Date language" value={c.locale} onChange={setAt('locale')} hint="ms-BN = Jumaat, 1 Januari 2027" maxLength={20} />
          </div>
        </Section>

        <Section title="Invitation wording" description="From the official invitation card. Arabic text is displayed right-to-left.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Text label="Bismillah" dir="rtl" lang="ar" value={c.invitation.bismillah} onChange={setAt('invitation.bismillah')} maxLength={200} />
            <Text label="Salam" dir="rtl" lang="ar" value={c.invitation.salam} onChange={setAt('invitation.salam')} maxLength={200} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Text label="Title (above the monogram)" value={c.hero.eyebrow} onChange={setAt('hero.eyebrow')} maxLength={80} />
            <Text label="Line below the names" value={c.hero.tagline} onChange={setAt('hero.tagline')} maxLength={120} placeholder="Optional" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Text label="Guest salutation" value={c.invitation.salutation} onChange={setAt('invitation.salutation')} maxLength={60} hint="Shown above the guest's name on personal RSVP links" />
            <Text label="Name apology note" value={c.invitation.nameNote} onChange={setAt('invitation.nameNote')} maxLength={200} />
          </div>
          <Text label="Invitation message" textarea value={c.invitation.message} onChange={setAt('invitation.message')} maxLength={1500} />
          <Text label="Word between the names" value={c.invitation.conjunction} onChange={setAt('invitation.conjunction')} maxLength={30} />
          <Text label="Closing / appreciation" textarea value={c.invitation.closing} onChange={setAt('invitation.closing')} maxLength={1500} />
          <Text label="Family heading" value={c.invitation.familyHeading} onChange={setAt('invitation.familyHeading')} maxLength={60} />
          <div>
            <span className="field-label">Family groups</span>
            <span className="field-hint mb-2 block">Shown side by side under the heading. Names: one per line, exactly as they should appear.</span>
            <ListEditor
              items={c.invitation.familyGroups}
              onChange={setAt('invitation.familyGroups')}
              addLabel="Add family group"
              emptyItem={{ title: '', members: '' }}
              max={4}
              fields={[
                { key: 'title', label: 'Group title', placeholder: 'e.g. Keluarga Pengantin Perempuan', wide: true },
                { key: 'members', label: 'Names (one per line)', type: 'textarea', rows: 6 },
              ]}
            />
          </div>
          <div>
            <span className="field-label">Hero photo</span>
            <ImageField value={c.hero.imageUrl} onChange={setAt('hero.imageUrl')} />
          </div>
          <Text label="Footer message" value={c.footer.message} onChange={setAt('footer.message')} maxLength={200} placeholder="To be confirmed" />
        </Section>

        <Section title="Our story" description="Not on the invitation — write it here, then switch on “Our Story” under Website sections.">
          <Text label="Introduction" textarea value={c.story.intro} onChange={setAt('story.intro')} maxLength={600} placeholder="To be confirmed" />
          <Text label="'How we met' title" value={c.story.howWeMet.title} onChange={setAt('story.howWeMet.title')} maxLength={80} placeholder="To be confirmed" />
          <Text label="'How we met' story" textarea value={c.story.howWeMet.text} onChange={setAt('story.howWeMet.text')} maxLength={4000} placeholder="To be confirmed" />
          <div>
            <span className="field-label">Couple photo</span>
            <ImageField value={c.story.howWeMet.imageUrl} onChange={setAt('story.howWeMet.imageUrl')} />
          </div>
          <div>
            <span className="field-label">Timeline & milestones</span>
            <ListEditor
              items={c.story.timeline}
              onChange={setAt('story.timeline')}
              fields={[
                { key: 'date', label: 'When', placeholder: 'e.g. June 2021' },
                { key: 'title', label: 'Title' },
                { key: 'text', label: 'Description', type: 'textarea' },
                { key: 'imageUrl', label: 'Photo', type: 'image', wide: true },
              ]}
              emptyItem={{ date: '', title: '', text: '', imageUrl: '' }}
              addLabel="Add milestone"
              max={20}
            />
          </div>
        </Section>

        <Section title="Wedding details page">
          <Text label="Schedule note" value={c.info.scheduleNote} onChange={setAt('info.scheduleNote')} maxLength={300} placeholder="Optional" />
          <Text label="Dress code" textarea value={c.info.dressCodeNote} onChange={setAt('info.dressCodeNote')} maxLength={1000} placeholder="To be confirmed — hidden from guests while empty" />
          <Text label="Travel & parking" textarea value={c.info.travelNote} onChange={setAt('info.travelNote')} maxLength={1500} placeholder="To be confirmed — hidden from guests while empty" />
          <div>
            <span className="field-label">FAQ</span>
            <ListEditor
              items={c.info.faq}
              onChange={setAt('info.faq')}
              fields={[
                { key: 'q', label: 'Question', wide: true },
                { key: 'a', label: 'Answer', type: 'textarea' },
              ]}
              emptyItem={{ q: '', a: '' }}
              addLabel="Add question"
              max={30}
            />
          </div>
          <div>
            <span className="field-label">Contacts</span>
            <ListEditor
              items={c.info.contacts}
              onChange={setAt('info.contacts')}
              fields={[
                { key: 'name', label: 'Name' },
                { key: 'role', label: 'Role' },
                { key: 'phone', label: 'Phone', type: 'tel' },
                { key: 'email', label: 'Email', type: 'email' },
              ]}
              emptyItem={{ name: '', role: '', phone: '', email: '' }}
              addLabel="Add contact"
              max={8}
            />
          </div>
          <Toggle label="Show gift information" checked={c.info.gifts.enabled} onChange={setAt('info.gifts.enabled')} />
          {c.info.gifts.enabled && (
            <>
              <Text label="Gift message" textarea value={c.info.gifts.message} onChange={setAt('info.gifts.message')} maxLength={600} />
              <div className="grid gap-4 sm:grid-cols-3">
                <Text label="Bank" value={c.info.gifts.bankName} onChange={setAt('info.gifts.bankName')} maxLength={80} />
                <Text label="Account name" value={c.info.gifts.accountName} onChange={setAt('info.gifts.accountName')} maxLength={80} />
                <Text label="Account number" value={c.info.gifts.accountNumber} onChange={setAt('info.gifts.accountNumber')} maxLength={40} />
              </div>
            </>
          )}
        </Section>

        <Section title="RSVP" description="These rules are enforced by the database, not just the page.">
          <label className="block">
            <span className="field-label">RSVP mode</span>
            <select className="field-input" value={cols.rsvp_mode} onChange={(e) => setCol('rsvp_mode')(e.target.value)}>
              <option value="open">Open — anyone with the website link can RSVP</option>
              <option value="invite_only">Invite only — guests must use their personal link</option>
              <option value="closed">Closed — no new RSVPs or changes</option>
            </select>
          </label>
          <Text label="RSVP deadline" type="date" value={cols.rsvp_deadline} onChange={setCol('rsvp_deadline')} hint="Replies close at the end of this day (wedding time zone)." />
        </Section>

        <Section title="Guest contributions">
          <Toggle label="Guestbook open" description="Guests can leave wishes — they appear immediately; hide or delete any under Wishes" checked={cols.greetings_enabled} onChange={setCol('greetings_enabled')} />
          <Toggle label="Photo sharing open" description="Guests can upload photos for review" checked={cols.photo_uploads_enabled} onChange={setCol('photo_uploads_enabled')} />
        </Section>

        <Section title="Website sections">
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              ['envelope', 'Envelope opening animation'],
              ['countdown', 'Countdown'],
              ['story', 'Our Story'],
              ['events', 'Events'],
              ['gallery', 'Gallery'],
              ['info', 'Wedding details'],
            ].map(([key, label]) => (
              <Toggle key={key} label={label} checked={c.sections[key]} onChange={setAt(`sections.${key}`)} />
            ))}
          </div>
        </Section>

        <ShareLinks />
      </div>

      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-champagne bg-ivory/95 px-4 py-3 backdrop-blur lg:left-60">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
            <span className="text-sm text-muted">You have unsaved changes</span>
            <button type="button" className="btn-primary btn-sm" onClick={save} disabled={busy}>
              <Save className="size-4" /> {busy ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function ShareLinks() {
  const links = [
    { label: 'Website', url: siteUrl() },
    { label: 'Photo upload (print this QR at the venue)', url: `${siteUrl()}/share` },
    { label: 'RSVP', url: `${siteUrl()}/rsvp` },
  ]
  return (
    <Section title="Share links & QR codes" description="Print the photo-upload QR code on table cards so guests can share from their phones.">
      <div className="grid gap-4 md:grid-cols-3">
        {links.map((l) => (
          <QrCard key={l.url} {...l} />
        ))}
      </div>
    </Section>
  )
}

function QrCard({ label, url }) {
  const [src, setSrc] = useState('')
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    QRCode.toDataURL(url, { width: 600, margin: 2, color: { dark: '#3a342d', light: '#ffffff' } }).then(setSrc, () => setSrc(''))
  }, [url])
  return (
    <div className="flex flex-col items-center rounded-2xl border border-champagne bg-white p-4 text-center">
      {src && <img src={src} alt={`QR code for ${url}`} className="size-40" />}
      <p className="mt-2 text-xs font-medium text-ink">{label}</p>
      <p className="mt-0.5 text-[0.65rem] break-all text-muted">{url}</p>
      <div className="mt-3 flex gap-1">
        <button
          type="button"
          className="btn-ghost btn-sm px-3"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url)
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            } catch {
              setCopied(false)
            }
          }}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />} Copy
        </button>
        {src && (
          <a className="btn-ghost btn-sm px-3" href={src} download={`qr-${label.split(' ')[0].toLowerCase()}.png`}>
            <Download className="size-4" /> PNG
          </a>
        )}
      </div>
    </div>
  )
}
