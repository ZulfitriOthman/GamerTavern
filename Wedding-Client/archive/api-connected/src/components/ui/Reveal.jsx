import { motion } from 'motion/react'

/** Fades content up as it scrolls into view (motion honours reduced-motion via MotionConfig). */
export function Reveal({ children, delay = 0, className = '', as = 'div', ...props }) {
  const Tag = motion[as]
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -60px 0px' }}
      transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
      {...props}
    >
      {children}
    </Tag>
  )
}
