import { useEffect, useRef } from 'react'
import { motion } from 'motion/react'

// one row of chips with a sliding active pill
const spring = { type: 'spring', stiffness: 500, damping: 38 }

export default function FolderChips ({ folders, active, onSelect }) {
  const rowRef = useRef(null)

  // keep the active chip in view
  useEffect(() => {
    rowRef.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [active])

  const chip = (id, label) => {
    const on = active === id
    return (
      <motion.button
        key={id}
        type="button"
        aria-pressed={on}
        whileTap={{ scale: 0.94 }}
        onClick={() => onSelect(id)}
        className={`relative inline-flex h-9 max-w-40 shrink-0 cursor-pointer items-center rounded-full bg-surface-container px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary ${on ? 'text-on-secondary-container' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
      >
        {on && <motion.span layoutId="folder-pill" transition={spring} className="absolute inset-0 rounded-full bg-secondary-container" />}
        <span className="relative truncate">{label}</span>
      </motion.button>
    )
  }

  return (
    <div
      ref={rowRef}
      aria-label="Folders"
      className="no-scrollbar flex gap-2 overflow-x-auto px-4 pt-3 pb-1 [mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)] pr-8"
    >
      {chip('all', 'All')}
      {[...folders].sort((a, b) => a.order - b.order).map(f => chip(f.id, f.name))}
    </div>
  )
}
