// Storage layer: the only file that talks to IndexedDB (+ clipboard helper).
// If the app ever moves to native storage, swap this file — not the UI.
export const DEFAULT_FOLDER = 'inbox'

let dbp
function open () {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open('note', 1)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('folders')) {
          const folders = db.createObjectStore('folders', { keyPath: 'id' })
          folders.add({ id: DEFAULT_FOLDER, name: 'Inbox', order: 0, createdAt: Date.now() })
        }
        if (!db.objectStoreNames.contains('snippets')) {
          db.createObjectStore('snippets', { keyPath: 'id' }).createIndex('folderId', 'folderId')
        }
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
export const putSnippet = s => tx('snippets', 'readwrite', t => t.objectStore('snippets').put(s))
export const deleteFolder = id => tx('folders', 'readwrite', t => t.objectStore('folders').delete(id))
export const deleteSnippet = id => tx('snippets', 'readwrite', t => t.objectStore('snippets').delete(id))
// Import atomically so a failed replacement can never erase the existing library.
export const importData = (folders, snippets, replace = false) =>
  tx(['folders', 'snippets'], 'readwrite', transaction => {
    const folderStore = transaction.objectStore('folders')
    const snippetStore = transaction.objectStore('snippets')
    if (replace) {
      folderStore.clear()
      snippetStore.clear()
    }
    for (const folder of folders) folderStore.put(folder)
    for (const snippet of snippets) snippetStore.put(snippet)
    if (!folders.some(folder => folder.id === DEFAULT_FOLDER)) {
      folderStore.put({ id: DEFAULT_FOLDER, name: 'Inbox', order: 0, createdAt: Date.now() })
    }
    return null
  })

export const newId = () => crypto.randomUUID()

// Re-assign every snippet of a deleted folder to the default folder.
export async function reassignToDefault (folderId) {
  const snippets = await getSnippets()
  const moved = snippets.filter(s => s.folderId === folderId)
  for (const s of moved) await putSnippet({ ...s, folderId: DEFAULT_FOLDER })
  return moved.length
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
