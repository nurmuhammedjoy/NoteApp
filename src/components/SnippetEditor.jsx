import { useEffect, useRef, useState } from 'react'
import { CopyIcon, EditIcon, ExpandMoreIcon } from '../icons.jsx'
import { IconButton } from '../ui.jsx'
import { cutWords } from '../text.js'

const Icon = ({ d }) => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor"><path d={d} /></svg>
)
const CHEVRON_DOWN = 'm7.41 8.59 4.59 4.58 4.59-4.58L18 10l-6 6-6-6z'
const ARROW_BACK = 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z'
const CHECK = 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z'

export default function SnippetEditor ({ open, folders, snippet, searchQuery = '', onClose, onSave, onCopy }) {
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [folderId, setFolderId] = useState('inbox')
  const [folderMenuOpen, setFolderMenuOpen] = useState(false)
  const textRef = useRef(null)
  const folderMenuRef = useRef(null)
  const [searchView, setSearchView] = useState(false)
  const [activeMatch, setActiveMatch] = useState(0)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (!open) return
    setTitle(snippet?.title || '')
    setText(snippet?.text || '')
    setFolderId(snippet?.folderId || 'inbox')
    setFolderMenuOpen(false)
    setSearchView(Boolean(searchQuery && snippet))
    setActiveMatch(0)
    if (!snippet) requestAnimationFrame(() => textRef.current?.focus())
  }, [open, snippet])

  // Grow the textarea with its content: reset to auto height, then measure.
  useEffect(() => {
    const el = textRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [text, open])

  const q = searchQuery.trim()
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const matches = q ? [...(title.matchAll(new RegExp(escaped, 'gi'))).map(m => ({ field: 'title', index: m.index })), ...(text.matchAll(new RegExp(escaped, 'gi'))).map(m => ({ field: 'text', index: m.index }))] : []
  const highlight = (value, field) => {
    if (!q) return value
    const pieces = []
    let last = 0
    let index = field === 'title' ? 0 : matches.filter(m => m.field === 'title').length
    for (const m of value.matchAll(new RegExp(escaped, 'gi'))) {
      pieces.push(value.slice(last, m.index))
      pieces.push(<mark key={m.index} className={`font-semibold ${index === activeMatch ? 'rounded-[3px] bg-primary text-on-primary' : 'bg-transparent text-primary'}`}>{m[0]}</mark>)
      last = m.index + m[0].length
      index++
    }
    pieces.push(value.slice(last))
    return pieces
  }

  // Scroll the active match to the middle of the content area (after render, so the DOM is current).
  useEffect(() => {
    const box = scrollRef.current
    const el = box?.querySelectorAll('mark')[activeMatch]
    if (!el) return
    const b = box.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    box.scrollBy({ top: r.top - b.top - (b.height - r.height) / 2, behavior: 'smooth' })
  }, [open, searchView, activeMatch, q])

  const goToMatch = index => matches.length && setActiveMatch((index + matches.length) % matches.length)

  if (!open) return null

  const save = () => {
    if (!text.trim()) return onClose()          // empty note = discard it (same as Google Keep)
    const auto = cutWords(text.trim().split('\n')[0], 64)
    onSave({ title: title.trim() || auto, text, folderId })
  }

  const sorted = [...folders].sort((a, b) => a.order - b.order)
  const selectedFolder = sorted.find(folder => folder.id === folderId) || sorted[0]

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface text-on-surface">
      {/* top bar */}
      <div className="flex items-center justify-between px-3 pt-[max(env(safe-area-inset-top),0.75rem)] pb-2">
        <button onClick={searchView ? onClose : save} aria-label="Back" className="grid h-12 w-12 place-items-center rounded-full active:bg-on-surface/8">
          <Icon d={ARROW_BACK} />
        </button>
        {searchView && matches.length > 0 && <div className="text-sm">{activeMatch + 1} of {matches.length}</div>}
        <button
          onClick={searchView ? () => setSearchView(false) : save}
          disabled={!text.trim()}
          aria-label={searchView ? 'Edit note' : 'Save'}
          className="grid h-12 w-12 place-items-center rounded-2xl bg-secondary-container text-on-secondary-container hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
        >
          {searchView ? <EditIcon className="size-6" /> : <Icon d={CHECK} />}
        </button>
      </div>

      {/* content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 pb-24">
        {searchView ? <div className="w-full py-3 text-[28px] leading-tight break-words">{highlight(title, 'title')}</div> : <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Title"
          className="w-full bg-transparent py-3 text-[28px] leading-tight outline-none placeholder:text-on-surface-variant"
        />}
        {searchView ? <div className="mt-2 min-h-[50vh] w-full whitespace-pre-wrap break-words text-[17px] leading-relaxed">{highlight(text, 'text')}</div> : <textarea
          ref={textRef}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Note"
          rows={1}
          className="mt-2 block min-h-[50vh] w-full resize-none bg-transparent text-[17px] leading-relaxed outline-none placeholder:text-on-surface-variant"
          onKeyDown={e => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              e.preventDefault()
              save()
            }
          }}
        />}
      </div>

      {/* bottom bar */}
      {searchView ? <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-4 pt-2 pb-[max(env(safe-area-inset-bottom),1rem)]">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-surface-container-high p-1.5 shadow-lg">
          <IconButton variant="tonal" className="size-12" disabled={!matches.length} onClick={() => goToMatch(activeMatch - 1)} aria-label="Previous match"><ExpandMoreIcon className="rotate-180" /></IconButton>
          <span className="min-w-20 text-center text-sm font-medium tabular-nums text-on-surface">{matches.length ? `${activeMatch + 1} / ${matches.length}` : 'No matches'}</span>
          <IconButton variant="tonal" className="size-12" disabled={!matches.length} onClick={() => goToMatch(activeMatch + 1)} aria-label="Next match"><ExpandMoreIcon /></IconButton>
          <span aria-hidden="true" className="mx-1 h-6 w-px bg-outline-variant" />
          <IconButton className="size-12" onClick={() => onCopy?.(text)} aria-label="Copy note"><CopyIcon /></IconButton>
        </div>
      </div> : <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-surface px-4 pt-2 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <div className="relative" ref={folderMenuRef}>
          {folderMenuOpen && (
            <>
              <button
                type="button"
                aria-label="Close folder menu"
                className="fixed inset-0 z-10 cursor-default"
                onClick={() => setFolderMenuOpen(false)}
              />
              <div role="listbox" aria-label="Choose folder" className="absolute bottom-[calc(100%+0.5rem)] left-0 z-20 max-h-64 min-w-48 overflow-y-auto rounded-2xl bg-surface-container-high p-2 text-sm text-on-surface shadow-2xl">
                {sorted.map(folder => (
                  <button
                    key={folder.id}
                    type="button"
                    role="option"
                    aria-selected={folderId === folder.id}
                    onClick={() => {
                      setFolderId(folder.id)
                      setFolderMenuOpen(false)
                    }}
                    className={`flex min-h-12 w-full items-center justify-between rounded-xl px-4 text-left transition-colors ${folderId === folder.id ? 'bg-secondary-container text-on-secondary-container' : 'hover:bg-on-surface/8'}`}
                  >
                    <span>{folder.name}</span>
                    {folderId === folder.id && <span aria-hidden="true" className="ml-5 inline-flex h-5 w-5 shrink-0"><Icon d={CHECK} /></span>}
                  </button>
                ))}
              </div>
            </>
          )}
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={folderMenuOpen}
            onClick={() => setFolderMenuOpen(open => !open)}
            className="flex h-12 min-w-32 items-center justify-between gap-5 rounded-2xl bg-surface-container px-4 text-sm text-on-surface transition-colors hover:bg-surface-container-high active:bg-surface-container-highest"
          >
            <span className="truncate">{selectedFolder?.name || 'Folder'}</span>
            <svg aria-hidden="true" viewBox="0 0 24 24" className={`h-5 w-5 shrink-0 transition-transform duration-200 ${folderMenuOpen ? 'rotate-180' : ''}`} fill="currentColor">
              <path d={CHEVRON_DOWN} />
            </svg>
          </button>
        </div>
      </div>}
    </div>
  )
}
