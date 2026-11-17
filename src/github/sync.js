// Sync cycle: pull -> merge (tombstones, newer-wins + conflict copy) -> apply locally -> push.
import { DEFAULT_FOLDER, applySync, getFolders, getMeta, getSnippets, getTombstones, newId, putMeta } from '../db.js'
import { StaleError, readArchive, readHead, writeArchive } from './repository.js'

const DAY = 86400000
const PUSH_DELAY = 10000
const TOMBSTONE_TTL = 30 * DAY

const byId = list => new Map(list.map(x => [x.id, x]))
const sig = f => `${f.name}|${f.order}`
const same = (a, b) => a.title === b.title && a.text === b.text && a.folderId === b.folderId

function mergeFolders (local, remote, base) {
  const l = byId(local)
  const r = byId(remote)
  const out = []
  for (const id of new Set([...l.keys(), ...r.keys()])) {
    const a = l.get(id)
    const b = r.get(id)
    const s = base?.[id]
    if (id === DEFAULT_FOLDER) out.push(a || b)
    else if (a && b) out.push(s && sig(a) === s ? b : a) // local untouched -> take remote
    else if (a) { if (!s || sig(a) !== s) out.push(a) } // new/edited locally; else deleted remotely
    else if (!s || sig(b) !== s) out.push(b) // new/edited remotely; else deleted locally
  }
  return out
}

// Pure merge of two library states. `base` = { lastSyncAt, folders } from the previous cycle.
export function merge (local, remote, base, now) {
  const since = base.lastSyncAt || 0
  const tomb = new Map()
  for (const t of [...local.tombstones, ...remote.tombstones]) {
    if (!tomb.has(t.id) || t.deletedAt > tomb.get(t.id).deletedAt) tomb.set(t.id, t)
  }
  const folders = mergeFolders(local.folders, remote.folders, base.folders)
  const folderIds = new Set(folders.map(f => f.id))
  const l = byId(local.snippets)
  const r = byId(remote.snippets)
  const snippets = []
  for (const id of new Set([...l.keys(), ...r.keys()])) {
    const a = l.get(id)
    const b = r.get(id)
    let pick = a || b
    if (a && b && !same(a, b)) {
      const winner = b.updatedAt > a.updatedAt ? b : a
      const loser = winner === a ? b : a
      // Edited on both sides since the last sync: keep the loser as a new snippet.
      if (a.updatedAt > since && b.updatedAt > since) {
        snippets.push({ ...loser, id: newId(), title: `${loser.title} (conflict)`, updatedAt: now })
      }
      pick = winner
    }
    const t = tomb.get(id)
    if (t && pick.updatedAt <= t.deletedAt) continue // deleted (and not edited after the delete)
    if (t) tomb.delete(id) // edited after the delete: resurrect, drop the tombstone
    snippets.push(pick)
  }
  // Prune tombstones older than 30 days that both sides already hold.
  const localIds = new Set(local.tombstones.map(t => t.id))
  const remoteIds = new Set(remote.tombstones.map(t => t.id))
  const tombstones = [...tomb.values()].filter(t => !(t.deletedAt < now - TOMBSTONE_TTL && localIds.has(t.id) && remoteIds.has(t.id)))
  return {
    folders,
    snippets: snippets.map(s => (folderIds.has(s.folderId) ? s : { ...s, folderId: DEFAULT_FOLDER })),
    tombstones,
  }
}

/* ---- cycle ---- */

const listeners = new Set()
const emit = e => listeners.forEach(fn => fn(e))
export function onSyncEvent (fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

async function cycle () {
  const gh = await getMeta('github')
  if (!gh?.token || !gh.repo) return { skipped: true }
  const startedAt = Date.now()
  let changed = false
  for (let attempt = 0; attempt < 3; attempt++) {
    const [folders, snippets, tombstones] = await Promise.all([getFolders(), getSnippets(), getTombstones()])
    const local = { folders, snippets, tombstones }
    const head = await readHead(gh)

    // Remote untouched since our last cycle (or empty): nothing to pull, local state wins.
    const remote = head.sha && head.sha !== gh.lastSyncSha ? await readArchive(gh, head) : null
    const merged = remote
      ? merge(local, remote, { lastSyncAt: gh.lastSyncAt, folders: gh.baseFolders }, startedAt)
      : local

    if (remote) {
      const lSn = byId(snippets)
      const mSn = byId(merged.snippets)
      const lFo = byId(folders)
      const mFo = byId(merged.folders)
      const putSnippets = merged.snippets.filter(s => !lSn.has(s.id) || !same(lSn.get(s.id), s) || lSn.get(s.id).updatedAt !== s.updatedAt)
      const deleteSnippets = snippets.filter(s => !mSn.has(s.id)).map(s => s.id)
      const putFolders = merged.folders.filter(f => !lFo.has(f.id) || sig(lFo.get(f.id)) !== sig(f))
      const deleteFolders = folders.filter(f => !mFo.has(f.id)).map(f => f.id)
      const tombstonesChanged = JSON.stringify(merged.tombstones) !== JSON.stringify(tombstones)
      if (putSnippets.length || deleteSnippets.length || putFolders.length || deleteFolders.length || tombstonesChanged) {
        await applySync({
          putFolders,
          deleteFolders,
          putSnippets,
          deleteSnippets,
          tombstones: merged.tombstones,
          tombstonesBefore: JSON.stringify(tombstones),
          guard: Object.fromEntries(snippets.map(s => [s.id, s.updatedAt])),
        })
        changed = changed || putSnippets.length > 0 || deleteSnippets.length > 0 || putFolders.length > 0 || deleteFolders.length > 0
      }
    }

    let sha
    try {
      sha = await writeArchive(gh, head, merged, `Sync ${new Date(startedAt).toISOString()}`)
    } catch (e) {
      if (e instanceof StaleError) continue // remote moved: pull again, merge, retry (never force-push)
      throw e
    }
    const cur = await getMeta('github')
    if (cur?.token) {
      await putMeta({
        ...cur,
        lastSyncAt: startedAt,
        lastSyncSha: sha,
        baseFolders: Object.fromEntries(merged.folders.map(f => [f.id, sig(f)])),
      })
    }
    return { changed }
  }
  throw new Error('The repository kept changing. Try again.')
}

// Module-level promise chain: one cycle at a time.
let chain = Promise.resolve()
let timer

// Runs a full pull + push. Resolves { skipped } | { changed }; rejects with a readable message.
export function syncNow ({ auto = false } = {}) {
  clearTimeout(timer)
  const run = chain.then(cycle)
  chain = run.catch(() => {})
  return run.then(
    result => {
      emit({ auto, changed: !!result.changed })
      return result
    },
    error => {
      emit({ auto, error: error.message })
      throw error
    },
  )
}

// Debounced push after a local change (~10 s idle).
export function scheduleSync () {
  clearTimeout(timer)
  timer = setTimeout(() => syncNow({ auto: true }).catch(() => {}), PUSH_DELAY)
}
