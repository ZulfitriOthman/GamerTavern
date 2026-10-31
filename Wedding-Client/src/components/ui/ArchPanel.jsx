import { MihrabFrame } from '../decor/Geometric.jsx'

/**
 * A white invitation card with a layered mihrab-arch top — the recurring frame
 * for Undangan, Atur Cara, Tempat Majlis and Terima Kasih. The top padding
 * scales with the card's width (cqw) so content always clears the curve.
 */
export function ArchPanel({ className = '', bodyClassName = '', children, ...props }) {
  return (
    <div className={`@container relative isolate ${className}`} {...props}>
      <MihrabFrame variant="panel" className="-z-10" />
      <div className={`relative px-6 pt-[max(5.5rem,27cqw)] pb-12 text-center sm:px-10 ${bodyClassName}`}>{children}</div>
    </div>
  )
}
