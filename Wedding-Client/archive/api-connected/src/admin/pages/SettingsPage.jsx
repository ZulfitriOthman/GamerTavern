import { Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Field, Toggle } from '../../components/ui/Field.jsx'
import { LoadError } from '../../components/ui/Feedback.jsx'
import { defaultContent } from '../../config/content.js'
import { deepMerge, setPath } from '../../lib/content.js'
import { isoDate } from '../../lib/time.js'
import { getSettings, saveSettings } from '../../services/adminService.js'
import { useAction, useAdminAsync } from '../auth.jsx'
import { ImageField, ListEditor, PageTitle, SkeletonRows } from '../components/shared.jsx'
import { hhmm } from '../lib.js'

/** API settings → editable form. Unknown content keys are kept (deepMerge copies them). */
function toForm(s) {
  const content = deepMerge(defaultContent, s?.content)
  return {
    wedding_date: isoDate(s?.wedding_date) ?? '',
    wedding_time: hhmm(s?.wedding_time),
    timezone: s?.timezone || 'Asia/Brunei',
    rsvp_mode: s?.rsvp_mode || 'open',
    rsvp_deadline: isoDate(s?.rsvp_deadline) ?? '',
    greetings_enabled: Boolean(Number(s?.greetings_enabled)),
    greetings_auto_approve: Boolean(Number(s?.greetings_auto_approve)),
    photo_uploads_enabled: Boolean(Number(s?.photo_uploads_enabled)),
    content: {
      ...content,
      invitation: { ...content.invitation, familyGroups: Array.isArray(content.invitation.familyGroups) ? content.invitation.familyGroups : [] },
      story: { ...content.story, timeline: Array.isArray(content.story.timeline) ? content.story.timeline : [] },
      info: {
        ...content.info,
        faq: Array.isArray(content.info.faq) ? content.info.faq : [],
        contacts: Array.isArray(content.info.contacts) ? content.info.contacts : [],
      },
    },
  }
}

export default function SettingsPage() {
  const { data, loading, error, reload } = useAdminAsync(getSettings)
  if (error && !data) return <LoadError message={error} onRetry={reload} />
  if (loading || !data) return <SkeletonRows rows={6} />
  return <SettingsEditor initial={data} />
}

function SettingsEditor({ initial }) {
  const [form, setForm] = useState(() => toForm(initial))
  const [saved, setSaved] = useState(() => JSON.stringify(toForm(initial)))
  const action = useAction()
  const dirty = JSON.stringify(form) !== saved

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    if (!dirty) return
    const warn = (e) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const c = form.content
  const set = (key) => (v) => setForm((f) => ({ ...f, [key]: v?.target ? v.target.value : v }))
  const setC = (path) => (v) => setForm((f) => ({ ...f, content: setPath(f.content, path, v?.target ? v.target.value : v) }))
  const text = (path, label, props = {}) => {
    const value = path.split('.').reduce((o, k) => o?.[k], c) ?? ''
    return <Field label={label} value={value} onChange={setC(path)} {...props} />
  }

  const save = async () => {
    const body = { ...form, wedding_date: form.wedding_date || null, wedding_time: form.wedding_time || null, rsvp_deadline: form.rsvp_deadline || null }
    const result = await action.run(() => saveSettings(body), 'Settings saved. Reload the public website to see your changes.')
    if (result && typeof result === 'object') {
      const f = toForm(result)
      setForm(f)
      setSaved(JSON.stringify(f))
    }
  }

  return (
    <div className="pb-28">
      <PageTitle title="Settings" description="Everything guests see on the website. Empty fields are hidden from guests." />

      <Section title="Wedding" description="Used for the countdown and calendar links.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Wedding date" type="date" value={form.wedding_date} onChange={set('wedding_date')} />
          <Field label="Time" type="time" value={form.wedding_time} onChange={set('wedding_time')} />
          <Field label="Time zone" value={form.timezone} onChange={set('timezone')} hint="e.g. Asia/Brunei" maxLength={64} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {text('locale', 'Date language', { hint: 'e.g. ms-BN or en-GB', maxLength: 20 })}
          {text('hijriDate', 'Hijri date (optional)', { maxLength: 60 })}
        </div>
      </Section>

      <Section title="The couple">
        <div className="grid gap-4 sm:grid-cols-2">
          {text('couple.partnerOne', 'First name (partner one)', { maxLength: 60 })}
          {text('couple.partnerTwo', 'First name (partner two)', { maxLength: 60 })}
          {text('couple.fullNameOne', 'Full name (partner one)', { maxLength: 160 })}
          {text('couple.fullNameTwo', 'Full name (partner two)', { maxLength: 160 })}
          {text('couple.monogram', 'Monogram', { maxLength: 4, hint: 'Shown on the envelope seal, e.g. AB' })}
          {text('couple.hashtag', 'Hashtag', { maxLength: 60 })}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {[
            ['one', 'Partner one'],
            ['two', 'Partner two'],
          ].map(([key, label]) => (
            <div key={key} className="space-y-4 rounded-2xl border border-linen bg-white/60 p-4">
              <p className="font-display text-sm tracking-[0.16em] uppercase">{label} — profile card</p>
              {text(`couple.profiles.${key}.role`, 'Role', { maxLength: 40, hint: 'e.g. The Bride, The Groom, Pengantin Perempuan' })}
              <div>
                <span className="field-label">Portrait</span>
                <ImageField value={c.couple.profiles?.[key]?.photoUrl ?? ''} onChange={setC(`couple.profiles.${key}.photoUrl`)} />
              </div>
              {text(`couple.profiles.${key}.parents`, 'Parents line', { maxLength: 200, hint: 'e.g. Son of … / Putera kepada …' })}
              {text(`couple.profiles.${key}.bio`, 'Short biography', { as: 'textarea', maxLength: 600, counter: true })}
              {text(`couple.profiles.${key}.instagram`, 'Instagram', { maxLength: 80, hint: '@handle or https://instagram.com/… (optional)' })}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Home page">
        <div className="grid gap-4 sm:grid-cols-2">
          {text('hero.eyebrow', 'Small heading above the names', { maxLength: 80 })}
          {text('hero.tagline', 'Tagline', { maxLength: 200 })}
        </div>
        <div>
          <span className="field-label">Hero photo</span>
          <ImageField value={c.hero.imageUrl} onChange={setC('hero.imageUrl')} />
        </div>
        {text('footer.message', 'Footer message', { as: 'textarea', maxLength: 300 })}
      </Section>

      <Section title="Invitation wording" description="Shown on the home page as the invitation card.">
        <div className="grid gap-4 sm:grid-cols-2">
          {text('invitation.bismillah', 'Opening line (e.g. Bismillah)', { maxLength: 200, dir: 'auto' })}
          {text('invitation.salam', 'Greeting (e.g. salam)', { maxLength: 200, dir: 'auto' })}
          {text('invitation.heading', 'Heading', { maxLength: 120 })}
          {text('invitation.salutation', 'Salutation', { maxLength: 120 })}
        </div>
        {text('invitation.message', 'Invitation message', { as: 'textarea', maxLength: 1500, counter: true })}
        <div className="grid gap-4 sm:grid-cols-2">
          {text('invitation.conjunction', 'Word between the names', { maxLength: 30, hint: 'e.g. & or Dengan' })}
          {text('invitation.nameNote', 'Note under the names', { maxLength: 300 })}
        </div>
        {text('invitation.closing', 'Closing words', { as: 'textarea', maxLength: 1500, counter: true })}
        {text('invitation.familyHeading', 'Family list heading', { maxLength: 80 })}
        <div>
          <span className="field-label">Family groups</span>
          <ListEditor
            items={c.invitation.familyGroups}
            onChange={setC('invitation.familyGroups')}
            fields={[
              { key: 'title', label: 'Group title', wide: true },
              { key: 'members', label: 'Names (one per line)', type: 'textarea', rows: 6 },
            ]}
            emptyItem={{ title: '', members: '' }}
            addLabel="Add family group"
            max={6}
          />
        </div>
      </Section>

      <Section title="Our story">
        {text('story.intro', 'Introduction', { as: 'textarea', maxLength: 600 })}
        {text('story.howWeMet.title', '“How we met” title', { maxLength: 80 })}
        {text('story.howWeMet.text', '“How we met” story', { as: 'textarea', maxLength: 4000, counter: true })}
        <div>
          <span className="field-label">Couple photo</span>
          <ImageField value={c.story.howWeMet.imageUrl} onChange={setC('story.howWeMet.imageUrl')} />
        </div>
        <div>
          <span className="field-label">Timeline & milestones</span>
          <ListEditor
            items={c.story.timeline}
            onChange={setC('story.timeline')}
            fields={[
              { key: 'date', label: 'When', placeholder: 'e.g. June 2021' },
              { key: 'title', label: 'Title' },
              { key: 'text', label: 'Description', type: 'textarea' },
              { key: 'imageUrl', label: 'Photo', type: 'image' },
            ]}
            emptyItem={{ date: '', title: '', text: '', imageUrl: '' }}
            addLabel="Add milestone"
            max={20}
          />
        </div>
      </Section>

      <Section title="Wedding details page">
        {text('info.scheduleNote', 'Schedule note', { maxLength: 300 })}
        {text('info.dressCodeNote', 'Dress code', { as: 'textarea', maxLength: 1000 })}
        {text('info.travelNote', 'Travel & parking', { as: 'textarea', maxLength: 1500 })}
        <div>
          <span className="field-label">FAQ</span>
          <ListEditor
            items={c.info.faq}
            onChange={setC('info.faq')}
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
            onChange={setC('info.contacts')}
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
        <Toggle label="Show gift information" checked={c.info.gifts.enabled} onChange={setC('info.gifts.enabled')} />
        {c.info.gifts.enabled && (
          <div className="space-y-4 rounded-2xl border border-champagne bg-white/50 p-4">
            {text('info.gifts.message', 'Gift message', { as: 'textarea', maxLength: 600 })}
            <div className="grid gap-4 sm:grid-cols-3">
              {text('info.gifts.bankName', 'Bank', { maxLength: 80 })}
              {text('info.gifts.accountName', 'Account name', { maxLength: 80 })}
              {text('info.gifts.accountNumber', 'Account number', { maxLength: 40 })}
            </div>
          </div>
        )}
      </Section>

      <Section title="Guest interactions">
        <Field label="RSVP mode" as="select" value={form.rsvp_mode} onChange={set('rsvp_mode')}>
          <option value="open">Open — anyone with the website can reply</option>
          <option value="invite_only">Invite only — personal links only</option>
          <option value="closed">Closed</option>
        </Field>
        <Field label="RSVP deadline" type="date" value={form.rsvp_deadline} onChange={set('rsvp_deadline')} hint="Optional. Replies close at the end of this day." className="sm:w-64" />
        <div className="divide-y divide-champagne/60">
          <Toggle label="Guestbook open" description="Guests can leave wishes." checked={form.greetings_enabled} onChange={set('greetings_enabled')} />
          <Toggle
            label="Auto-approve wishes"
            description="Stored setting. The current API publishes valid wishes immediately; you can hide any wish afterwards."
            checked={form.greetings_auto_approve}
            onChange={set('greetings_auto_approve')}
          />
          <Toggle label="Photo sharing open" description="Guests can upload photos and videos." checked={form.photo_uploads_enabled} onChange={set('photo_uploads_enabled')} />
        </div>
      </Section>

      <Section title="Website sections" description="Turn parts of the website on or off.">
        <div className="divide-y divide-champagne/60">
          {[
            ['envelope', 'Envelope opening animation'],
            ['countdown', 'Countdown'],
            ['story', 'Our story'],
            ['couple', 'Bride & groom cards'],
            ['events', 'Events'],
            ['venue', 'Venue & map'],
            ['gallery', 'Gallery'],
            ['wishes', 'Wishes on the home page'],
            ['info', 'Details & FAQ page'],
          ].map(([key, label]) => (
            <Toggle key={key} label={label} checked={Boolean(c.sections[key])} onChange={setC(`sections.${key}`)} />
          ))}
        </div>
      </Section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-champagne/80 bg-ivory/95 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <div className="min-w-0 flex-1 text-sm">
            {action.error ? (
              <span className="text-rose" role="alert">{action.error}</span>
            ) : dirty ? (
              <span className="text-gold-deep">You have unsaved changes.</span>
            ) : (
              <span className="text-muted">{action.notice || 'All changes saved.'}</span>
            )}
          </div>
          <div className="flex gap-2">
            {dirty && (
              <button type="button" className="btn-ghost" onClick={() => setForm(JSON.parse(saved))} disabled={action.busy}>
                Discard
              </button>
            )}
            <button type="button" className="btn-primary" onClick={save} disabled={!dirty || action.busy}>
              <Save className="size-4" aria-hidden="true" /> {action.busy ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({ title, description, children }) {
  return (
    <section className="card mb-5 p-5 sm:p-6">
      <h2 className="font-serif text-2xl">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  )
}
