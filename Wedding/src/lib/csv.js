// CSV export with protection against spreadsheet formula injection:
// guest-supplied values starting with = + - @ (or tab/CR) are prefixed with '
// so Excel / Sheets treat them as text instead of executing them.

function cell(value) {
  if (value === null || value === undefined) return ''
  let s = String(value)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** columns: [{ key, label, value?: (row) => any }] */
export function toCsv(rows, columns) {
  const header = columns.map((c) => cell(c.label)).join(',')
  const body = rows.map((row) => columns.map((c) => cell(c.value ? c.value(row) : row[c.key])).join(','))
  return [header, ...body].join('\r\n')
}

export function downloadText(filename, text, type = 'text/csv;charset=utf-8') {
  const blob = new Blob(['﻿', text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
