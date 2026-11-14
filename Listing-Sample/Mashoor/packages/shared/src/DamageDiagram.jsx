// Vehicle damage diagram with numbered markers. Marker positions are stored as
// fractions (0–1) of the image's width and height, so they stay on the same
// spot at any display or print size.
//
// Editing: click / tap the diagram to add a marker; select a marker to move it
// with the arrow keys (Shift = larger steps) or remove it; each marker has its
// own note in the list below the diagram.
import { useRef, useState } from 'react'
import { Icon } from './Icon.jsx'
import { newKey } from './checklist.js'

const clamp = (v) => Math.min(1, Math.max(0, v))
const round = (v) => Math.round(v * 10000) / 10000

export function DamageDiagram({ src, alt, markers, onChange, readOnly, compact }) {
  const frame = useRef(null)
  const [selected, setSelected] = useState(null)
  const [failed, setFailed] = useState(false)
  const editable = !readOnly && typeof onChange === 'function'

  function place(event) {
    if (!editable || !frame.current) return
    // Clicks on an existing marker select it instead (handled there).
    if (event.target.closest('.marker')) return
    const box = frame.current.getBoundingClientRect()
    const x = round(clamp((event.clientX - box.left) / box.width))
    const y = round(clamp((event.clientY - box.top) / box.height))
    const marker = { id: newKey('m'), x, y, note: '' }
    onChange([...markers, marker])
    setSelected(marker.id)
  }

  function update(id, patch) {
    onChange(markers.map((m) => (m.id === id ? { ...m, ...patch } : m)))
  }

  function remove(id) {
    onChange(markers.filter((m) => m.id !== id))
    if (selected === id) setSelected(null)
  }

  function nudge(event, marker) {
    const step = event.shiftKey ? 0.02 : 0.005
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
    if (moves[event.key]) {
      event.preventDefault()
      const [dx, dy] = moves[event.key]
      update(marker.id, { x: round(clamp(marker.x + dx)), y: round(clamp(marker.y + dy)) })
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      remove(marker.id)
    }
  }

  return (
    <div className={`damage${compact ? ' compact' : ''}`}>
      <div
        ref={frame}
        className={`damage-frame${editable ? ' editable' : ''}`}
        onClick={place}
        role={editable ? 'application' : undefined}
        aria-label={editable ? `${alt}. Click or tap to mark damage.` : undefined}
      >
        {failed ? (
          <div className="damage-missing">The diagram image couldn’t load.</div>
        ) : (
          <img src={src} alt={alt} draggable="false" onError={() => setFailed(true)} />
        )}
        {markers.map((m, i) =>
          editable ? (
            <button
              key={m.id}
              type="button"
              className={`marker${selected === m.id ? ' selected' : ''}`}
              style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%` }}
              aria-label={`Damage marker ${i + 1}${m.note ? `: ${m.note}` : ''}. Arrow keys move it, Delete removes it.`}
              aria-pressed={selected === m.id}
              onClick={(e) => {
                e.stopPropagation()
                setSelected(m.id)
              }}
              onKeyDown={(e) => nudge(e, m)}
            >
              {i + 1}
            </button>
          ) : (
            <span key={m.id} className="marker" style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%` }} aria-hidden="true">
              {i + 1}
            </span>
          ),
        )}
      </div>

      {editable && <p className="field-hint damage-help">Click or tap the diagram where the vehicle is damaged, scratched or dented. Select a marker to move it with the arrow keys.</p>}

      {markers.length > 0 && (
        <ol className="marker-list">
          {markers.map((m, i) => (
            <li key={m.id} className={selected === m.id ? 'selected' : undefined}>
              <span className="marker static" aria-hidden="true">
                {i + 1}
              </span>
              {editable ? (
                <>
                  <label className="visually-hidden" htmlFor={`note-${m.id}`}>
                    Note for damage marker {i + 1}
                  </label>
                  <input
                    id={`note-${m.id}`}
                    className="input"
                    value={m.note}
                    maxLength={1000}
                    placeholder="What is damaged here?"
                    onFocus={() => setSelected(m.id)}
                    onChange={(e) => update(m.id, { note: e.target.value })}
                  />
                  <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => remove(m.id)} aria-label={`Remove damage marker ${i + 1}`}>
                    <Icon name="trash" />
                  </button>
                </>
              ) : (
                <span className="prewrap">{m.note || <span className="muted">No note</span>}</span>
              )}
            </li>
          ))}
        </ol>
      )}
      {!editable && markers.length === 0 && <p className="muted damage-none">No damage marked on the diagram.</p>}
    </div>
  )
}
