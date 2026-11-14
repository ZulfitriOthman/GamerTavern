import { useState } from 'react'
import { PasswordInput } from '@mashoor/shared/PasswordInput'
import { ROLE_LABELS } from '@mashoor/shared/inspection'
import { Field } from '@mashoor/shared/ui'

// Mirrors the API rule (Backend/mashoor/src/validate.js). Usernames are not
// case-sensitive: "Alice" and "alice" are the same account.
const USERNAME_PATTERN = '[A-Za-z0-9][A-Za-z0-9._\\-]{2,39}'
const USERNAME_HINT = '3–40 letters, digits, dots, dashes or underscores. Not case-sensitive.'

export function UsernameInput({ defaultValue, error }) {
  return (
    <Field label="Username" hint={USERNAME_HINT} error={error}>
      <input
        className="input"
        name="username"
        defaultValue={defaultValue}
        minLength={3}
        maxLength={40}
        pattern={USERNAME_PATTERN}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
      />
    </Field>
  )
}

// Vendor / Client (catalogs, inspection verification) or Inspector (fills in checklists).
export function RoleSelect({ defaultValue = 'client' }) {
  return (
    <Field label="Role" hint="Both roles sign in at the same portal and get their own pages.">
      <select className="select" name="role" defaultValue={defaultValue}>
        <option value="client">{ROLE_LABELS.client}</option>
        <option value="inspector">{ROLE_LABELS.inspector}</option>
      </select>
    </Field>
  )
}

export function RoleBadge({ role }) {
  return <span className={`badge plain ${role === 'inspector' ? 'accent' : ''}`.trim()}>{ROLE_LABELS[role] ?? role}</span>
}

// Password + confirmation chosen by staff, with a live mismatch message.
// Read on submit with readNewPassword() from ./accountForm.js.
export function NewPasswordFields({ label = 'Password', error }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const mismatch = confirm.length > 0 && confirm !== password ? 'Passwords do not match.' : ''
  return (
    <>
      <PasswordInput
        label={label}
        name="password"
        maxLength={200}
        hint="At least 10 characters."
        error={error?.password}
        onInput={(event) => setPassword(event.currentTarget.value)}
      />
      <PasswordInput
        label={`Confirm ${label.toLowerCase()}`}
        name="confirmPassword"
        maxLength={200}
        error={mismatch || error?.confirmPassword}
        onInput={(event) => setConfirm(event.currentTarget.value)}
      />
    </>
  )
}
