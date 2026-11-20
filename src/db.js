// Storage layer: the only file that talks to IndexedDB (+ clipboard helper).
// If the app ever moves to native storage, swap this file — not the UI.
export const DEFAULT_FOLDER = 'inbox'

let dbp
function open () {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open('note', 2)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('folders')) {
          const folders = db.createObjectStore('folders', { keyPath: 'id' })
          folders.add({ id: DEFAULT_FOLDER, name: 'Inbox', order: 0, createdAt: Date.now() })
        }
        if (!db.objectStoreNames.contains('snippets')) {
          db.createObjectStore('snippets', { keyPath: 'id' }).createIndex('folderId', 'folderId')
        }
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' })
      }
      req.onsuccess = () => {
        const db = req.result
        db.onversionchange = () => {
          db.close()
          dbp = undefined
        }
        resolve(db)
      }
      req.onerror = () => reject(req.error)
      req.onblocked = () => reject(new Error('Database upgrade blocked'))
    }).catch(error => {
      dbp = undefined
      throw error
    })
  }
  return dbp
}

function tx (stores, mode, fn) {
  return open().then(db => new Promise((resolve, reject) => {
    const transaction = db.transaction(stores, mode)
    let result
    try {
      result = fn(transaction)
    } catch (error) {
      transaction.abort()
      reject(error)
      return
    }
    transaction.oncomplete = () => resolve(result?.result)
    transaction.onabort = () => reject(transaction.error || result?.error || new Error('Storage transaction aborted'))
    transaction.onerror = () => reject(transaction.error || new Error('Storage transaction failed'))
  }))
}

export const getFolders = () => tx('folders', 'readonly', t => t.objectStore('folders').getAll())
export const getSnippets = () => tx('snippets', 'readonly', t => t.objectStore('snippets').getAll())
export const putFolder = f => tx('folders', 'readwrite', t => t.objectStore('folders').put(f))
// Sync state (GitHub session, last sync, snippet tombstones) lives in the `meta` store.
export const getMeta = key => tx('meta', 'readonly', t => t.objectStore('meta').get(key))
export const putMeta = record => tx('meta', 'readwrite', t => t.objectStore('meta').put(record))
export const deleteMeta = key => tx('meta', 'readwrite', t => t.objectStore('meta').delete(key))
export const getTombstones = () => getMeta('tombstones').then(r => r?.items ?? [])
const tombs = (t, fn) => {
  const m = t.objectStore('meta')
  m.get('tombstones').onsuccess = e => m.put({ key: 'tombstones', items: fn(e.target.result?.items ?? []) })
}

// Saving a snippet clears its tombstone, so Undo (or a re-import) is not deleted again by sync.
export const putSnippet = s => tx(['snippets', 'meta'], 'readwrite', t => {
  t.objectStore('snippets').put(s)
  tombs(t, items => items.filter(x => x.id !== s.id))
})
export const deleteSnippet = id => tx(['snippets', 'meta'], 'readwrite', t => {
  t.objectStore('snippets').delete(id)
  tombs(t, items => [...items.filter(x => x.id !== id), { id, deletedAt: Date.now() }])
})
// Import atomically so a failed replacement can never erase the existing library.
export const importData = (folders, snippets, replace = false) =>
  tx(['folders', 'snippets', 'meta'], 'readwrite', transaction => {
    const folderStore = transaction.objectStore('folders')
    const snippetStore = transaction.objectStore('snippets')
    const incoming = new Set(snippets.map(snippet => snippet.id))
    const oldKeys = replace ? snippetStore.getAllKeys() : null
    if (replace) {
      folderStore.clear()
      snippetStore.clear()
    }
    for (const folder of folders) folderStore.put(folder)
    for (const snippet of snippets) snippetStore.put(snippet)
    if (!folders.some(folder => folder.id === DEFAULT_FOLDER)) {
      folderStore.put({ id: DEFAULT_FOLDER, name: 'Inbox', order: 0, createdAt: Date.now() })
    }
    // Imported snippets are alive again; snippets wiped by "Replace all" are tombstoned for sync.
    tombs(transaction, items => [
      ...items.filter(x => !incoming.has(x.id)),
      ...(oldKeys?.result ?? []).filter(id => !incoming.has(id)).map(id => ({ id, deletedAt: Date.now() })),
    ])
    return null
  })

// Sync write-back in ONE transaction. `guard` maps id -> updatedAt seen when the sync read local
// state; a record edited or deleted meanwhile is skipped (the next cycle picks it up).
export const applySync = ({ putFolders, deleteFolders, putSnippets, deleteSnippets, tombstones, tombstonesBefore, guard }) =>
  tx(['folders', 'snippets', 'meta'], 'readwrite', t => {
    const folders = t.objectStore('folders')
    const store = t.objectStore('snippets')
    for (const f of putFolders) folders.put(f)
    for (const id of deleteFolders) folders.delete(id)
    for (const s of putSnippets) {
      store.get(s.id).onsuccess = e => {
        const cur = e.target.result
        if (cur ? cur.updatedAt === guard[s.id] : !(s.id in guard)) store.put(s)
      }
    }
    for (const id of deleteSnippets) {
      store.get(id).onsuccess = e => {
        if (e.target.result?.updatedAt === guard[id]) store.delete(id)
      }
    }
    const meta = t.objectStore('meta')
    meta.get('tombstones').onsuccess = e => {
      if (JSON.stringify(e.target.result?.items ?? []) === tombstonesBefore) meta.put({ key: 'tombstones', items: tombstones })
    }
    return null
  })

export const newId = () => crypto.randomUUID()

// Delete a folder and move its snippets to the default folder in ONE transaction, so a sync
// cycle can never run between the two steps. Moved snippets get a fresh `updatedAt`: that is
// what makes the move win the merge and trip the sync write-back guard.
export function deleteFolderAndReassign (id) {
  const out = { moved: 0, at: Date.now() }
  return tx(['folders', 'snippets'], 'readwrite', t => {
    t.objectStore('folders').delete(id)
    const store = t.objectStore('snippets')
    store.index('folderId').getAll(id).onsuccess = e => {
      for (const s of e.target.result) store.put({ ...s, folderId: DEFAULT_FOLDER, updatedAt: out.at })
      out.moved = e.target.result.length
    }
  }).then(() => out)
}

export async function copyText (text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  // Fallback for browsers without the async Clipboard API.
  const ta = document.createElement('textarea')
  ta.value = text
  document.body.appendChild(ta)
  try {
    ta.focus()
    ta.select()
    if (!document.execCommand('copy')) throw new Error('Clipboard copy failed')
  } finally {
    ta.remove()
  }
}
