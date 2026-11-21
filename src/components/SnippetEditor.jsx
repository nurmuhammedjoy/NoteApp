import { useEffect, useRef, useState } from 'react'
import { CopyIcon, EditIcon, ExpandMoreIcon } from '../icons.jsx'
import { IconButton } from '../ui.jsx'

const Icon = ({ d }) => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor"><path d={d} /></svg>
)
const CHEVRON_DOWN = 'm7.41 8.59 4.59 4.58 4.59-4.58L18 10l-6 6-6-6z'
const ARROW_BACK = 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z'
const CHECK = 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z'

// older notes stored the first line prefix as the title
// treat those as untitled so the title field is empty
const userTitle = snippet => {
  const title = snippet?.title || ''
  const first = (snippet?.text || '').trim().split('\n')[0]
  return title && first.startsWith(title) ? '' : title
}

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
  const titleRef = useRef(null)
  const bottomBarRef = useRef(null)
  const mirrorRef = useRef(null)
  const activeFieldRef = useRef(null)
  const revealFrameRef = useRef(0)

  const scheduleReveal = el => {
    if (!el) return
    activeFieldRef.current = el
    cancelAnimationFrame(revealFrameRef.current)
    // wait for the browser viewport resize before measuring
    revealFrameRef.current = requestAnimationFrame(() => requestAnimationFrame(() => revealCaret(el)))
  }

  // measure the caret offset with a hidden mirror
  const caretOffset = el => {
    const mirror = mirrorRef.current
    if (!mirror || !el.clientWidth) return 0
    const cs = getComputedStyle(el)
    const props = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontVariant', 'lineHeight', 'letterSpacing', 'textTransform', 'textIndent', 'wordSpacing', 'tabSize', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth']
    for (const prop of props) mirror.style[prop] = cs[prop]
    mirror.style.boxSizing = 'border-box'
    mirror.style.width = `${el.getBoundingClientRect().width}px`
    mirror.style.whiteSpace = 'pre-wrap'
    mirror.style.overflowWrap = 'break-word'
    mirror.style.wordBreak = 'normal'
    mirror.textContent = el.value.slice(0, el.selectionStart)
    const marker = document.createElement('span')
    marker.textContent = '\u200b'
    mirror.appendChild(marker)
    return marker.getBoundingClientRect().top - mirror.getBoundingClientRect().top
  }

  // scroll when the active field or caret is outside the visible area
  const revealCaret = el => {
    const box = scrollRef.current
    if (!box || !el) return
    const boxRect = box.getBoundingClientRect()
    const barTop = bottomBarRef.current?.getBoundingClientRect().top ?? boxRect.bottom
    const visibleTop = boxRect.top + box.clientTop
    const visibleBottom = Math.min(boxRect.bottom, barTop)
    let caretTop, caretBottom
    if (el.tagName === 'TEXTAREA') {
      const rect = el.getBoundingClientRect()
      const borderTop = parseFloat(getComputedStyle(el).borderTopWidth) || 0
      const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 24
      caretTop = rect.top + borderTop + caretOffset(el) - el.scrollTop
      caretBottom = caretTop + lineHeight
    } else {
      const rect = el.getBoundingClientRect()
      caretTop = rect.top
      caretBottom = rect.bottom
    }
    const margin = 8
    let delta = 0
    if (caretTop < visibleTop + margin) delta = caretTop - (visibleTop + margin)
    else if (caretBottom > visibleBottom - margin) delta = caretBottom - (visibleBottom - margin)
    if (delta) box.scrollTop = Math.max(0, box.scrollTop + delta)
  }

  useEffect(() => {
    if (!open) return
    const update = () => scheduleReveal(activeFieldRef.current)
    const viewport = window.visualViewport
    viewport?.addEventListener('resize', update)
    viewport?.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    return () => {
      viewport?.removeEventListener('resize', update)
      viewport?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      cancelAnimationFrame(revealFrameRef.current)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    setTitle(userTitle(snippet))
    setText(snippet?.text || '')
    setFolderId(snippet?.folderId || 'inbox')
    setFolderMenuOpen(false)
    setSearchView(Boolean(searchQuery && snippet))
    setActiveMatch(0)
    if (!snippet) requestAnimationFrame(() => {
      textRef.current?.focus({ preventScroll: true })
      scheduleReveal(textRef.current)
    })
  }, [open, snippet])

  // grow the title field as wrapped text adds lines
  useEffect(() => {
    const el = titleRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [title, open, searchView])

  // reset the text area height then measure its content
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

  // scroll the active match to the content center after render
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
    if (!text.trim()) return onClose()          // discard an empty note
    // keep the typed title and let the card choose its own fallback
    const draft = { title: title.trim(), text, folderId }
    // close without changing the update time or showing saved when nothing changed
    if (snippet && draft.title === userTitle(snippet) && draft.text === snippet.text && draft.folderId === snippet.folderId) return onClose()
    onSave(draft)
  }

  const sorted = [...folders].sort((a, b) => a.order - b.order)
  const selectedFolder = sorted.find(folder => folder.id === folderId) || sorted[0]

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface text-on-surface">
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

      <div ref={scrollRef} className="no-scrollbar flex-1 overflow-y-auto overscroll-contain px-5 pb-24 [-webkit-overflow-scrolling:touch]">
        {searchView ? <div className="w-full py-3 text-[28px] leading-tight break-words">{highlight(title, 'title')}</div> : <textarea
          ref={titleRef}
          value={title}
          rows={1}
          onChange={e => {
            setTitle(e.target.value.replace(/\s*\n+\s*/g, ' '))
            scheduleReveal(e.currentTarget)
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              textRef.current?.focus()
            }
          }}
          onFocus={e => scheduleReveal(e.currentTarget)}
          onClick={e => scheduleReveal(e.currentTarget)}
          onSelect={e => scheduleReveal(e.currentTarget)}
          onKeyUp={e => scheduleReveal(e.currentTarget)}
          placeholder="Title"
          enterKeyHint="next"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          name="note-title"
          data-lpignore="true"
          data-form-type="other"
          className="no-scrollbar block w-full resize-none overflow-hidden bg-transparent py-3 text-[28px] leading-tight break-words outline-none placeholder:text-on-surface-variant"
        />}
        {searchView ? <div className="mt-2 min-h-[50vh] w-full whitespace-pre-wrap break-words text-[17px] leading-relaxed">{highlight(text, 'text')}</div> : <textarea
          ref={textRef}
          value={text}
          onChange={e => {
            setText(e.target.value)
            scheduleReveal(e.currentTarget)
          }}
          onFocus={e => scheduleReveal(e.currentTarget)}
          onClick={e => scheduleReveal(e.currentTarget)}
          onSelect={e => scheduleReveal(e.currentTarget)}
          onKeyUp={e => scheduleReveal(e.currentTarget)}
          placeholder="Note"
          rows={1}
          autoComplete="off"
          name="note-body"
          data-lpignore="true"
          data-form-type="other"
          className="no-scrollbar mt-2 block min-h-[50vh] w-full resize-none overflow-hidden bg-transparent touch-pan-y text-[17px] leading-relaxed outline-none placeholder:text-on-surface-variant"
          onKeyDown={e => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              e.preventDefault()
              save()
            }
          }}
        />}
      </div>

      {/* mirror locates the caret across wrapped lines */}
      <div
        ref={mirrorRef}
        aria-hidden="true"
        style={{ position: 'fixed', left: '-10000px', top: 0, visibility: 'hidden', pointerEvents: 'none' }}
      />

      {searchView ? <div ref={bottomBarRef} className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-4 pt-2 pb-[max(env(safe-area-inset-bottom),1rem)]">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-surface-container-high p-1.5 shadow-lg">
          <IconButton variant="tonal" className="size-12" disabled={!matches.length} onClick={() => goToMatch(activeMatch - 1)} aria-label="Previous match"><ExpandMoreIcon className="rotate-180" /></IconButton>
          <span className="min-w-20 text-center text-sm font-medium tabular-nums text-on-surface">{matches.length ? `${activeMatch + 1} / ${matches.length}` : 'No matches'}</span>
          <IconButton variant="tonal" className="size-12" disabled={!matches.length} onClick={() => goToMatch(activeMatch + 1)} aria-label="Next match"><ExpandMoreIcon /></IconButton>
          <span aria-hidden="true" className="mx-1 h-6 w-px bg-outline-variant" />
          <IconButton className="size-12" onClick={() => onCopy?.(text)} aria-label="Copy note"><CopyIcon /></IconButton>
        </div>
      </div> : <div ref={bottomBarRef} className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-surface px-4 pt-2 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
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
