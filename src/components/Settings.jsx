import { useRef } from 'react'
import { motion } from 'motion/react'
import { IconButton } from '../ui.jsx'
import { ArrowBackIcon, CheckIcon, ChevronRightIcon, DownloadIcon, FolderOpenIcon, UploadIcon } from '../icons.jsx'
import { COLOR_THEMES } from '../theme.js'
import SyncSection from './SyncSection.jsx'

// grouped list with large outer corners and small inner corners
export const Group = ({ label, children }) => (
  <section className="mb-6">
    <h3 className="px-4 pb-2 text-sm font-medium text-primary">{label}</h3>
    <div className="flex flex-col gap-0.5 [&>*]:rounded-[6px] [&>*:first-child]:rounded-t-[28px] [&>*:last-child]:rounded-b-[28px]">
      {children}
    </div>
  </section>
)

export const Row = ({ icon, tone = 'bg-primary-container text-on-primary-container', title, text, onClick, disabled, trailing }) => (
  <motion.button
    type="button"
    whileTap={{ scale: 0.985 }}
    onClick={onClick}
    disabled={disabled}
    className="flex min-h-[76px] w-full cursor-pointer disabled:cursor-default disabled:opacity-70 items-center gap-4 bg-surface-container py-3 pr-4 pl-4 text-left outline-none transition-colors hover:bg-surface-container-high active:bg-surface-container-highest focus-visible:ring-2 focus-visible:ring-primary"
  >
    <span className={`grid size-12 shrink-0 place-items-center rounded-2xl [&>svg]:size-6 ${tone}`}>{icon}</span>
    <span className="min-w-0 flex-1">
      <span className="block text-base font-medium text-on-surface">{title}</span>
      <span className="block truncate text-sm text-on-surface-variant">{text}</span>
    </span>
    {trailing === undefined ? <ChevronRightIcon className="size-6 shrink-0 text-on-surface-variant" /> : trailing}
  </motion.button>
)

const Tile = ({ icon, tone, title, text, onClick, className }) => (
  <motion.button
    type="button"
    whileTap={{ scale: 0.96 }}
    onClick={onClick}
    className={`flex min-h-32 flex-1 cursor-pointer flex-col items-start justify-between p-5 text-left outline-none transition-[filter] hover:brightness-95 focus-visible:ring-2 focus-visible:ring-primary ${tone} ${className}`}
  >
    <span className="grid size-12 place-items-center rounded-full bg-on-surface/8 [&>svg]:size-7">{icon}</span>
    <span>
      <span className="block text-lg font-medium">{title}</span>
      <span className="block text-sm opacity-80">{text}</span>
    </span>
  </motion.button>
)

// full screen tab for appearance and library tools
export default function Settings ({ open, onClose, onExport, onImport, onManageFolders, onToast, folderCount, snippetCount, colorTheme, onColorThemeChange, canInstall, onInstall }) {
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
      <header className="flex h-16 shrink-0 items-center pl-2">
        <IconButton aria-label="Back" onClick={onClose}>
          <ArrowBackIcon />
        </IconButton>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto overscroll-contain px-4 pb-10">
        <h2 className="px-2 pt-2 pb-8 text-[44px] leading-[52px] font-normal tracking-tight">Settings</h2>

        <Group label="Appearance">
          <fieldset className="bg-surface-container p-4">
            <legend className="sr-only">Color theme</legend>
            <div className="grid grid-cols-6 gap-2">
              {COLOR_THEMES.map(theme => {
                const on = colorTheme === theme.id
                return (
                  <button
                    key={theme.id}
                    type="button"
                    aria-label={`${theme.label} color theme`}
                    aria-pressed={on}
                    onClick={() => onColorThemeChange(theme.id)}
                    className="flex min-w-0 cursor-pointer flex-col items-center gap-2 rounded-2xl py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <motion.span
                      aria-hidden="true"
                      animate={{ borderRadius: on ? '28%' : '50%', scale: on ? 1 : 0.88 }}
                      whileTap={{ scale: 0.8 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 26 }}
                      className="grid size-12 place-items-center text-white"
                      style={{ backgroundColor: theme.color }}
                    >
                      {on && <CheckIcon className="size-6" />}
                    </motion.span>
                    <span className={`truncate ${on ? 'font-medium text-on-surface' : 'text-on-surface-variant'}`}>{theme.label}</span>
                  </button>
                )
              })}
            </div>
          </fieldset>
        </Group>

        <Group label="Library">
          <Row
            icon={<FolderOpenIcon />}
            title="Manage folders"
            text={`${folderCount} folder${folderCount === 1 ? '' : 's'} · ${snippetCount} snippet${snippetCount === 1 ? '' : 's'}`}
            onClick={onManageFolders}
          />
        </Group>

        <SyncSection onToast={onToast} />

        {canInstall && (
          <Group label="App">
            <Row icon={<DownloadIcon />} title="Install app" text="Add Note to your home screen" onClick={onInstall} />
          </Group>
        )}

        <section>
          <h3 className="px-4 pb-2 text-sm font-medium text-primary">Backup</h3>
          <div className="flex gap-0.5">
            <Tile
              icon={<DownloadIcon />}
              tone="bg-primary-container text-on-primary-container"
              title="Export"
              text="Save as .zip"
              onClick={onExport}
              className="rounded-[6px] rounded-l-[28px]"
            />
            <Tile
              icon={<UploadIcon />}
              tone="bg-tertiary-container text-on-tertiary-container"
              title="Import"
              text=".zip or .json"
              onClick={() => fileRef.current?.click()}
              className="rounded-[6px] rounded-r-[28px]"
            />
          </div>
        </section>
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
