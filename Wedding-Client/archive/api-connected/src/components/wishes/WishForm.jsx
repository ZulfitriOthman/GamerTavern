import { Send } from 'lucide-react'
import { useState } from 'react'
import { useSite } from '../../context/SiteContext.jsx'
import { errorMessage } from '../../lib/api.js'
import { LIMITS, validateWish } from '../../lib/validation.js'
import { submitWish } from '../../services/publicService.js'
import { Field, Honeypot } from '../ui/Field.jsx'
import { Notice } from '../ui/Feedback.jsx'

const EMPTY = { name: '', relationship: '', message: '' }

/** onPublished(item) is called when the API reports the wish is live. */
export function WishForm({ onPublished }) {
  const { ready, settings } = useSite()
  const [values, setValues] = useState(EMPTY)
  const [website, setWebsite] = useState('')
  const [errors, setErrors] = useState({})
  const [state, setState] = useState({ status: 'idle', message: '' })

  if (!ready) return <Notice>The guestbook will open as soon as the website has loaded.</Notice>
  if (!settings.greetings_enabled) return <Notice title="The guestbook is closed">Thank you for all the lovely wishes.</Notice>

  const set = (key) => (e) => {
    setValues((v) => ({ ...v, [key]: e.target.value }))
    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }))
  }

  const submit = async (e) => {
    e.preventDefault()
    if (state.status === 'sending') return
    const found = validateWish(values)
    setErrors(found)
    if (Object.keys(found).length) return
    setState({ status: 'sending', message: '' })
    try {
      const result = await submitWish({ ...values, website })
      if (result.status === 'duplicate') {
        setState({ status: 'info', message: 'We already have this wish from you — thank you!' })
      } else if (result.status === 'published') {
        setState({ status: 'success', message: 'Thank you! Your wish is now on the wall.' })
        if (result.item) onPublished?.(result.item)
        setValues(EMPTY)
      } else {
        setState({ status: 'success', message: 'Thank you! Your wish will appear once the couple has seen it.' })
        setValues(EMPTY)
      }
    } catch (error) {
      setState({ status: 'error', message: errorMessage(error) })
    }
  }

  const sending = state.status === 'sending'
  return (
    <form onSubmit={submit} noValidate className="relative space-y-4">
      <Honeypot value={website} onChange={setWebsite} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" required autoComplete="name" value={values.name} onChange={set('name')} maxLength={LIMITS.name} error={errors.name} />
        <Field label="Relationship" placeholder="e.g. Cousin, colleague" value={values.relationship} onChange={set('relationship')} maxLength={LIMITS.relationship} error={errors.relationship} />
      </div>
      <Field
        as="textarea"
        label="Your wishes"
        required
        rows={4}
        placeholder="May your marriage be filled with love and happiness…"
        value={values.message}
        onChange={set('message')}
        maxLength={LIMITS.wish}
        counter
        error={errors.message}
      />
      {state.message && state.status !== 'sending' && <Notice tone={state.status === 'error' ? 'error' : state.status === 'success' ? 'success' : 'info'}>{state.message}</Notice>}
      <button type="submit" className="btn-primary w-full sm:w-auto" disabled={sending}>
        <Send className="size-4" aria-hidden="true" />
        {sending ? 'Sending…' : 'Send your wishes'}
      </button>
    </form>
  )
}
