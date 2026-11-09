import useReveal from '../hooks/useReveal'

function RevealSection({
  as: Tag = 'div',
  delay = 0,
  immediate = false,
  className = '',
  children,
}) {
  const [ref, visible] = useReveal({ immediate })
  const classes = ['reveal', visible && 'is-visible', className]
    .filter(Boolean)
    .join(' ')

  return (
    <Tag
      ref={ref}
      className={classes}
      style={delay ? { '--reveal-delay': `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  )
}

export default RevealSection
