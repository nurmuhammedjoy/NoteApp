import { useRef } from 'react'
import { motion } from 'motion/react'
import { IconButton } from '../ui.jsx'
import { ArrowBackIcon, DownloadIcon, UploadIcon } from '../icons.jsx'

const Row = ({ icon, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex h-14 w-full cursor-pointer items-center gap-4 rounded-2xl px-4 text-left text-base text-on-surface transition-colors hover:bg-on-surface/8 active:bg-on-surface/12 [&>svg]:size-6 [&>svg]:text-on-surface-variant"
  >
    {icon}
    {label}
  </button>
)

// Full-screen tab opened from the ⋮ menu: library backup (export / import).
export default function Settings ({ open, onClose, onExport, onImport }) {
  const fileRef = useRef(null)
  if (!open) return null

  return (
    <motion.section
      aria-label="Settings"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 36 }}
      className="fixed inset-0 z-50 flex flex-col bg-surface text-on-surface"
    >
      <header className="flex h-16 shrink-0 items-center gap-2 pr-3 pl-2">
        <IconButton aria-label="Back" onClick={onClose}>
          <ArrowBackIcon />
        </IconButton>
        <h2 className="text-[22px] leading-7 font-medium">Settings</h2>
      </header>

      <main className="flex-1 overflow-y-auto overscroll-contain px-4 pt-2">
        <p className="px-4 pt-3 pb-1 text-xs font-medium text-on-surface-variant">Backup</p>
        <div className="flex flex-col gap-1">
          <Row icon={<DownloadIcon />} label="Export library" onClick={onExport} />
          <Row icon={<UploadIcon />} label="Import from file" onClick={() => fileRef.current?.click()} />
        </div>
      </main>

      <input
        ref={fileRef}
        type="file"
        accept=".zip,.json"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) onImport(f)
          e.target.value = ''
        }}
      />
    </motion.section>
  )
}
