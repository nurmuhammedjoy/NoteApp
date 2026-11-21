import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { FabMenu, Snackbar } from './ui.jsx'
import { EditIcon, FolderOpenIcon } from './icons.jsx'
import TopBar from './components/TopBar.jsx'
import FolderChips from './components/FolderChips.jsx'
import SnippetCard from './components/SnippetCard.jsx'
import SnippetEditor from './components/SnippetEditor.jsx'
import FolderManager, { NewFolderDialog } from './components/FolderManager.jsx'
import ImportDialog from './components/ImportDialog.jsx'
import Settings from './components/Settings.jsx'
import { COLOR_THEMES } from './theme.js'
import { copyText, deleteFolderAndReassign, deleteSnippet, getFolders, getSnippets, importData, newId, putFolder, putSnippet } from './db.js'
import { exportArchive, readArchive } from './io.js'
import { onSyncEvent, scheduleSync, syncNow } from './github/sync.js'
import useInstall from './install.js'

const mergeById = (current, incoming) => {
  const map = new Map(current.map(x => [x.id, x]))
  for (const x of incoming) map.set(x.id, x)
  return [...map.values()]
}

const readColorTheme = () => {
  try {
    const saved = localStorage.getItem('note-color-theme')
    return COLOR_THEMES.some(theme => theme.id === saved) ? saved : 'purple'
  } catch {
    return 'purple'
  }
}

export default function App () {
  const [folders, setFolders] = useState([])
  const [snippets, setSnippets] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [folder, setFolder] = useState('all')
  const [editing, setEditing] = useState(null) // empty or new or a snippet
  const [editingQuery, setEditingQuery] = useState('')
  const [managerOpen, setManagerOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [colorTheme, setColorTheme] = useState(readColorTheme)
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [pendingImport, setPendingImport] = useState(null)
  const [toast, setToast] = useState(null) // message and optional deleted snippet
  const searchRef = useRef(null)
  const { canInstall, install } = useInstall()
  // cards in the first batch skip the enter animation
  // later cards animate after create delete undo or filter
  const loadedRef = useRef(false)

  useEffect(() => {
    document.documentElement.dataset.colorTheme = colorTheme
    try { localStorage.setItem('note-color-theme', colorTheme) } catch {}
  }, [colorTheme])

  useEffect(() => {
    Promise.all([getFolders(), getSnippets()])
      .then(([f, s]) => { setFolders(f); setSnippets(s) })
      .catch(() => showToast('Could not load your library.'))
      .finally(() => setLoading(false))
      .then(() => syncNow({ auto: true }).catch(() => {})) // pull and push once on open
  }, [])

  // reload local data after sync and show background errors
  useEffect(() => onSyncEvent(e => {
    if (e.changed) Promise.all([getFolders(), getSnippets()]).then(([f, s]) => { setFolders(f); setSnippets(s) })
    if (e.error && e.auto) showToast(e.error)
  }), [])

  useEffect(() => {
    if (folders.length || snippets.length) loadedRef.current = true
  }, [folders, snippets])

  // slash focuses the search bar
  useEffect(() => {
    const onKey = e => {
      const tag = document.activeElement?.tagName
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const folderNames = useMemo(() => new Map(folders.map(f => [f.id, f.name])), [folders])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const rank = s => {
      const t = s.title.toLowerCase()
      return t.startsWith(q) ? 2 : q && t.includes(q) ? 1 : 0
    }
    return snippets
      .filter(s => (folder === 'all' || s.folderId === folder) &&
        (!q || s.title.toLowerCase().includes(q) || s.text.toLowerCase().includes(q)))
      .sort((a, b) => rank(b) - rank(a) || b.updatedAt - a.updatedAt)
  }, [snippets, query, folder])

  const showToast = message => setToast({ id: Date.now(), message })


  const saveSnippet = draft => {
    const now = Date.now()
    const doc = editing?.id
      ? { ...editing, ...draft, updatedAt: now }
      : { id: newId(), ...draft, createdAt: now, updatedAt: now }
    putSnippet(doc).then(() => {
      setSnippets(list => (list.some(s => s.id === doc.id) ? list.map(s => (s.id === doc.id ? doc : s)) : [...list, doc]))
      setEditing(null)
      showToast('Saved.')
      scheduleSync()
    })
  }

  const removeSnippet = snippet => {
    deleteSnippet(snippet.id).then(() => {
      setSnippets(list => list.filter(s => s.id !== snippet.id))
      setToast({ id: Date.now(), message: 'Snippet deleted.', deletedSnippet: snippet })
      scheduleSync()
    })
  }

  const undoDelete = () => {
    const s = toast?.deletedSnippet
    if (!s) return
    putSnippet(s).then(() => {
      setSnippets(list => (list.some(x => x.id === s.id) ? list : [...list, s]))
      setToast({ id: Date.now(), message: 'Restored.' })
      scheduleSync()
    })
  }


  const counts = useMemo(() => snippets.reduce((m, x) => ({ ...m, [x.folderId]: (m[x.folderId] || 0) + 1 }), {}), [snippets])

  const addFolder = name => {
    const f = { id: newId(), name, order: Math.max(0, ...folders.map(x => x.order)) + 1, createdAt: Date.now() }
    return putFolder(f).then(() => { setFolders(list => [...list, f]); scheduleSync() })
  }

  const renameFolderById = (f, name) =>
    putFolder({ ...f, name }).then(() => { setFolders(list => list.map(x => (x.id === f.id ? { ...x, name } : x))); scheduleSync() })

  const removeFolderById = f => {
    if (f.id === 'inbox') return
    deleteFolderAndReassign(f.id)
      .then(({ moved, at }) => {
        setFolders(list => list.filter(x => x.id !== f.id))
        setSnippets(list => list.map(s => (s.folderId === f.id ? { ...s, folderId: 'inbox', updatedAt: at } : s)))
        if (folder === f.id) setFolder('all')
        showToast(moved ? `Folder deleted. ${moved} snippet(s) moved to Inbox.` : 'Folder deleted.')
        scheduleSync()
      })
      .catch(() => showToast('Could not delete the folder.'))
  }


  const handleExport = () => exportArchive(folders, snippets).then(() => showToast('Exported.')).catch(() => showToast('Export failed.'))
  const handleImport = file =>
    readArchive(file)
      .then(setPendingImport)
      .catch(e => showToast(`Import failed: ${e.message || 'unrecognized file.'}`))
  const applyImport = replace => {
    const meta = pendingImport
    if (!meta) return
    importData(meta.folders, meta.snippets, replace)
      .then(() => {
        setFolders(replace ? meta.folders : mergeById(folders, meta.folders))
        setSnippets(replace ? meta.snippets : mergeById(snippets, meta.snippets))
        setPendingImport(null)
        setFolder('all')
        showToast('Imported.')
        scheduleSync()
      })
      .catch(() => showToast('Import failed.'))
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      <TopBar searchRef={searchRef} query={query} resultCount={visible.length} onQuery={setQuery} onSettings={() => setSettingsOpen(true)}>
        <FolderChips folders={folders} active={folder} onSelect={setFolder} />
      </TopBar>
      <main className="flex flex-1 flex-col gap-0.5 px-4 pt-2 pb-28">
        <AnimatePresence mode="popLayout" initial={false}>
          {visible.map((s, i) => (
            <motion.div
              key={s.id}
              layout="position"
              initial={loadedRef.current && { opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.15 } }}
              transition={{ type: 'spring', stiffness: 420, damping: 36 }}
            >
              <SnippetCard
                snippet={s}
                query={query}
                pos={visible.length === 1 ? 'only' : i === 0 ? 'first' : i === visible.length - 1 ? 'last' : 'middle'}
                folderName={folderNames.get(s.folderId) || 'Inbox'}
                onOpen={() => { setEditing(s); setEditingQuery(query.trim()) }}
                onCopy={() => copyText(s.text).then(() => showToast('Copied.'), () => showToast('Copy failed.'))}
                onDelete={() => removeSnippet(s)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
        {!loading && visible.length === 0 && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-6 pt-20 text-center text-base text-on-surface-variant"
          >
            {query ? 'No matches.' : snippets.length ? 'Nothing here yet.' : 'Your library is empty. Tap + to add a snippet.'}
          </motion.p>
        )}
      </main>
      <FabMenu
        actions={[
          { label: 'New folder', icon: <FolderOpenIcon />, onSelect: () => setNewFolderOpen(true) },
          { label: 'New snippet', icon: <EditIcon />, onSelect: () => setEditing('new') },
        ]}
      />
      <NewFolderDialog open={newFolderOpen} onClose={() => setNewFolderOpen(false)} onAdd={addFolder} />
      <SnippetEditor
        open={editing != null}
        folders={folders}
        snippet={editing === 'new' ? null : editing}
        searchQuery={editing === 'new' ? '' : editingQuery}
        onClose={() => { setEditing(null); setEditingQuery('') }}
        onSave={saveSnippet}
        onCopy={text => copyText(text).then(() => showToast('Copied.'), () => showToast('Copy failed.'))}
      />
      <FolderManager
        open={managerOpen}
        folders={folders}
        counts={counts}
        onClose={() => setManagerOpen(false)}
        onNew={() => setNewFolderOpen(true)}
        onRename={f => name => renameFolderById(f, name)}
        onDelete={removeFolderById}
      />
      <Settings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onExport={handleExport}
        onImport={handleImport}
        onManageFolders={() => setManagerOpen(true)}
        onToast={showToast}
        folderCount={folders.length}
        snippetCount={snippets.length}
        colorTheme={colorTheme}
        onColorThemeChange={setColorTheme}
        canInstall={canInstall}
        onInstall={install}
      />
      <ImportDialog
        data={pendingImport}
        onCancel={() => setPendingImport(null)}
        onMerge={() => applyImport(false)}
        onReplace={() => applyImport(true)}
      />
      <AnimatePresence>
        {toast && (
          <Snackbar
            key={toast.id}
            message={toast.message}
            action={toast.deletedSnippet ? { label: 'Undo', onClick: undoDelete } : undefined}
            duration={toast.deletedSnippet ? 7000 : 4000}
            onClose={() => setToast(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

