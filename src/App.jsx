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
import { copyText, deleteFolder, deleteSnippet, getFolders, getSnippets, importData, newId, putFolder, putSnippet, reassignToDefault } from './db.js'
import { exportArchive, readArchive } from './io.js'

const mergeById = (current, incoming) => {
  const map = new Map(current.map(x => [x.id, x]))
  for (const x of incoming) map.set(x.id, x)
  return [...map.values()]
}

export default function App () {
  const [folders, setFolders] = useState([])
  const [snippets, setSnippets] = useState([])
  const [query, setQuery] = useState('')
  const [folder, setFolder] = useState('all')
  const [editing, setEditing] = useState(null) // null | 'new' | snippet
  const [editingQuery, setEditingQuery] = useState('')
  const [managerOpen, setManagerOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [pendingImport, setPendingImport] = useState(null)
  const [toast, setToast] = useState(null) // { message, deletedSnippet? }
  const searchRef = useRef(null)

  useEffect(() => {
    Promise.all([getFolders(), getSnippets()]).then(([f, s]) => { setFolders(f); setSnippets(s) })
  }, [])

  // "/" focuses the search bar, fzf-style.
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

  /* ---- snippets ---- */

  const saveSnippet = draft => {
    const now = Date.now()
    const doc = editing?.id
      ? { ...editing, ...draft, updatedAt: now }
      : { id: newId(), ...draft, createdAt: now, updatedAt: now }
    putSnippet(doc).then(() => {
      setSnippets(list => (list.some(s => s.id === doc.id) ? list.map(s => (s.id === doc.id ? doc : s)) : [...list, doc]))
      setEditing(null)
      showToast('Saved.')
    })
  }

  const removeSnippet = snippet => {
    deleteSnippet(snippet.id).then(() => {
      setSnippets(list => list.filter(s => s.id !== snippet.id))
      setToast({ id: Date.now(), message: 'Snippet deleted.', deletedSnippet: snippet })
    })
  }

  const undoDelete = () => {
    const s = toast?.deletedSnippet
    if (!s) return
    putSnippet(s).then(() => {
      setSnippets(list => (list.some(x => x.id === s.id) ? list : [...list, s]))
      setToast({ id: Date.now(), message: 'Restored.' })
    })
  }

  /* ---- folders ---- */

  const addFolder = name => {
    const f = { id: newId(), name, order: Math.max(0, ...folders.map(x => x.order)) + 1, createdAt: Date.now() }
    return putFolder(f).then(() => setFolders(list => [...list, f]))
  }

  const renameFolderById = (f, name) =>
    putFolder({ ...f, name }).then(() => setFolders(list => list.map(x => (x.id === f.id ? { ...x, name } : x))))

  const removeFolderById = f => {
    if (f.id === 'inbox') return
    deleteFolder(f.id)
      .then(() => reassignToDefault(f.id))
      .then(count => {
        setFolders(list => list.filter(x => x.id !== f.id))
        setSnippets(list => list.map(s => (s.folderId === f.id ? { ...s, folderId: 'inbox' } : s)))
        if (folder === f.id) setFolder('all')
        showToast(count ? `Folder deleted. ${count} snippet(s) moved to Inbox.` : 'Folder deleted.')
      })
  }

  /* ---- import / export ---- */

  const handleExport = () => exportArchive(folders, snippets).then(() => showToast('Exported.')).catch(() => showToast('Export failed.'))
  const handleImport = file =>
    readArchive(file)
      .then(setPendingImport)
      .catch(() => showToast('Import failed: unrecognized file.'))
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
      })
      .catch(() => showToast('Import failed.'))
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      <TopBar searchRef={searchRef} query={query} resultCount={visible.length} onQuery={setQuery} onSettings={() => setSettingsOpen(true)} onManage={() => setManagerOpen(true)}>
        <FolderChips folders={folders} active={folder} onSelect={setFolder} />
      </TopBar>
      <main className="flex flex-1 flex-col gap-0.5 px-4 pt-2 pb-28">
        <AnimatePresence mode="popLayout" initial={false}>
          {visible.map((s, i) => (
            <motion.div
              key={s.id}
              layout="position"
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
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
        {visible.length === 0 && (
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
        onClose={() => setManagerOpen(false)}
        onRename={f => name => renameFolderById(f, name)}
        onDelete={removeFolderById}
      />
      <Settings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onExport={handleExport}
        onImport={handleImport}
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

