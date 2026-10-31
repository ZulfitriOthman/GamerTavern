const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

/** Deep-merges `override` onto `base`. Arrays and primitives from `override` replace base values. */
export function deepMerge(base, override) {
  if (!isPlainObject(override)) return base
  const out = { ...base }
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue
    out[key] = isPlainObject(value) && isPlainObject(base?.[key]) ? deepMerge(base[key], value) : value
  }
  return out
}
