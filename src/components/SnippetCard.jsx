import { useRef, useState } from 'react'
import { motion } from 'motion/react'
import { MenuButton } from '../ui.jsx'
import { CopyIcon, DeleteIcon } from '../icons.jsx'
import { cutWords, excerptFrom } from '../text.js'

const HOLD_MS = 800

// segmented list with large outer corners and small inner corners
const SHAPE = {
  only: 'rounded-[28px]',
  first: 'rounded-t-[28px] rounded-b-lg',
  middle: 'rounded-lg',
  last: 'rounded-t-lg rounded-b-[28px]',
}

// mark every match for the lowercased query
const Mark = ({ text, q }) => {
  if (!q) return text
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'i'))
  return parts.map((p, i) => (i % 2
    ? <mark key={i} className="bg-transparent font-semibold text-primary">{p}</mark>
    : p))
}

// height follows the title preview tag and date
export default function SnippetCard ({ snippet: s, folderName, pos = 'only', query = '', onOpen, onCopy, onDelete }) {
  const text = s.text.trim()
  const [holding, setHolding] = useState(false)
  const holdTimer = useRef(null)
  const copiedRef = useRef(false)

  // hold the item to copy and show a sweeping fill
  const startHold = () => {
    copiedRef.current = false
    setHolding(true)
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null
      copiedRef.current = true
      setHolding(false)
      navigator.vibrate?.(15)
      onCopy()
    }, HOLD_MS)
  }
  const cancelHold = () => {
    clearTimeout(holdTimer.current)
    holdTimer.current = null
    setHolding(false)
  }
  const handleClick = () => {
    if (copiedRef.current) {
      copiedRef.current = false
      return
    }
    onOpen()
  }

  let title = s.title || cutWords(text.split('\n')[0], 80)
  // finish older titles cut mid word using the snippet text
  if (text.startsWith(title) && /\S$/.test(title)) title += text.slice(title.length).match(/^\S*/)[0]
  let preview = text.startsWith(title) ? text.slice(title.length).trim() : text
  // keep the match visible in search excerpts
  const q = query.trim().toLowerCase()
  const hit = q ? preview.toLowerCase().indexOf(q) : -1
  if (hit > 40) preview = excerptFrom(preview, hit)
  const date = new Date(s.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

  return (
    <div className={`relative bg-surface-container transition-[background-color] duration-200 focus-within:z-30 hover:bg-surface-container-high ${SHAPE[pos]}`}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
        {holding && (
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            // show the sweep only after a real hold
            transition={{ delay: 0.15, duration: (HOLD_MS - 150) / 1000, ease: 'linear' }}
            className="h-full origin-left bg-primary/15"
          />
        )}
      </div>
      <div
        role="button"
        tabIndex={0}
        onPointerDown={startHold}
        onPointerUp={cancelHold}
        onPointerLeave={cancelHold}
        onPointerCancel={cancelHold}
        onContextMenu={e => e.preventDefault()}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onOpen()
          }
        }}
        onClick={handleClick}
        className="relative flex cursor-pointer flex-col gap-3 rounded-[inherit] py-4 pr-14 pl-5 outline-none select-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <div className="min-w-0">
          <p className="line-clamp-2 text-base leading-6 font-medium break-words"><Mark text={title} q={q} /></p>
          {preview && (
            <p className="mt-1 line-clamp-2 font-mono text-[13px] leading-5 break-words whitespace-pre-wrap text-on-surface-variant"><Mark text={preview} q={q} /></p>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-on-surface-variant">
          <span className="max-w-[60%] truncate rounded-full bg-secondary-container px-2.5 py-0.5 text-on-secondary-container">{folderName}</span>
          <span>{date}</span>
        </div>
      </div>
      <div className="absolute top-2 right-2">
        <MenuButton
          items={[
            { label: 'Copy', icon: <CopyIcon />, onSelect: onCopy },
            { label: 'Delete', icon: <DeleteIcon />, onSelect: onDelete },
          ]}
        />
      </div>
    </div>
  )
}

