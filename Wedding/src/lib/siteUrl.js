/** Public base URL used for invite links and QR codes. */
export function siteUrl() {
  const configured = import.meta.env.VITE_SITE_URL?.trim()
  return (configured || window.location.origin).replace(/\/+$/, '')
}
