// GitHub repo access (REST, Git Data API) + the shared archive serializer.
// Repo layout = the io.js archive format: metadata.json + snippets/NNN-<slug>.txt.
// metadata.json additionally carries `tombstones: [{ id, deletedAt }]`.
import { getMeta, putMeta } from '../db.js'
import { slug } from '../io.js'
import { AuthError, dropToken } from './auth.js'

const API = 'https://api.github.com'
const META = 'metadata.json'
const enc = new TextEncoder()

export class StaleError extends Error {}

async function api (token, path, { method = 'GET', body, accept = 'application/vnd.github+json', raw } = {}) {
  let res
  try {
    res = await fetch(path.startsWith('http') ? path : API + path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: accept,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error('Network error. Check your connection.')
  }
  if (res.status === 401) {
    await dropToken()
    throw new AuthError('GitHub session expired. Sign in again.')
  }
  if (!res.ok) {
    const d = await res.json().catch(() => ({}))
    if ((res.status === 403 || res.status === 429) && res.headers.get('x-ratelimit-remaining') === '0') {
      throw Object.assign(new Error('GitHub rate limit reached. Try again later.'), { status: res.status })
    }
    throw Object.assign(new Error(d.message || `GitHub error ${res.status}`), { status: res.status })
  }
  return raw ? res.text() : res.json()
}

/* ---- shared serializer (same file names as io.js exportArchive) ---- */

export function serialize ({ folders, snippets, tombstones }) {
  const files = new Map()
  const sorted = [...snippets].sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1))
  const stamp = Math.max(0, ...snippets.map(s => s.updatedAt), ...tombstones.map(t => t.deletedAt))
  const meta = {
    app: 'note',
    version: 1,
    // Derived from the data (not the clock) so identical libraries serialize to identical bytes.
    exportedAt: new Date(stamp).toISOString(),
    folders: [...folders]
      .sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : 1))
      .map(({ id, name, order, createdAt }) => ({ id, name, order, createdAt })),
    snippets: [],
    tombstones: [...tombstones].sort((a, b) => (a.id < b.id ? -1 : 1)).map(({ id, deletedAt }) => ({ id, deletedAt })),
  }
  sorted.forEach((s, i) => {
    const file = `snippets/${String(i + 1).padStart(3, '0')}-${slug(s.title || s.text || 'snippet')}.txt`
    files.set(file, s.text)
    meta.snippets.push({ id: s.id, title: s.title, folderId: s.folderId, createdAt: s.createdAt, updatedAt: s.updatedAt, file })
  })
  files.set(META, JSON.stringify(meta, null, 2) + '\n')
  return files
}

export function deserialize (metaText, texts) {
  let meta
  try { meta = JSON.parse(metaText) } catch { throw new Error('metadata.json in the repository is not valid JSON.') }
  if (meta?.app !== 'note' || !Array.isArray(meta.folders) || !Array.isArray(meta.snippets)) {
    throw new Error('The repository does not contain a Note library.')
  }
  return {
    folders: meta.folders,
    tombstones: Array.isArray(meta.tombstones) ? meta.tombstones : [],
    snippets: meta.snippets.map(({ file, ...s }) => {
      // Never guess: a missing text file must not turn into an empty snippet.
      if (!texts.has(file)) throw new Error(`Repository is incomplete (missing ${file}).`)
      return { ...s, text: texts.get(file) }
    }),
  }
}

// Git blob id of a text, to detect unchanged files without uploading them.
async function gitSha (text) {
  const body = enc.encode(text)
  const head = enc.encode(`blob ${body.length}\0`)
  const all = new Uint8Array(head.length + body.length)
  all.set(head)
  all.set(body, head.length)
  const digest = await crypto.subtle.digest('SHA-1', all)
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
}

/* ---- repo list / create / select (read the session themselves) ---- */

const session = async () => {
  const g = await getMeta('github')
  if (!g?.token) throw new AuthError('Sign in to GitHub first.')
  return g
}

export async function listMyRepos () {
  const { token } = await session()
  const out = []
  for (let page = 1; page <= 3; page++) {
    const batch = await api(token, `/user/repos?visibility=private&affiliation=owner,collaborator&sort=pushed&per_page=100&page=${page}`)
    out.push(...batch.filter(r => r.permissions?.push).map(r => ({ owner: r.owner.login, name: r.name, branch: r.default_branch })))
    if (batch.length < 100) break
  }
  return out
}

export async function createMyRepo (name) {
  const { token } = await session()
  const r = await api(token, '/user/repos', {
    method: 'POST',
    body: { name, private: true, description: 'Note app sync' },
  })
  return { owner: r.owner.login, name: r.name, branch: r.default_branch }
}

// Choosing a repo resets sync state: the next cycle merges from scratch.
export async function selectRepo (repo) {
  const g = await session()
  await putMeta({ ...g, repo, lastSyncAt: 0, lastSyncSha: null, baseFolders: null })
}

/* ---- pull ---- */

const slot = gh => `/repos/${gh.repo.owner}/${gh.repo.name}`

// Current branch head: { sha, treeSha, tree: Map(path -> blob sha) }. sha is null for an empty repo.
export async function readHead (gh) {
  let ref
  try {
    ref = await api(gh.token, `${slot(gh)}/git/ref/heads/${gh.repo.branch}`)
  } catch (e) {
    if (e.status === 404 || e.status === 409) return { sha: null, treeSha: null, tree: new Map() }
    throw e
  }
  const commit = await api(gh.token, `${slot(gh)}/git/commits/${ref.object.sha}`)
  const t = await api(gh.token, `${slot(gh)}/git/trees/${commit.tree.sha}?recursive=1`)
  if (t.truncated) throw new Error('Repository is too large to sync.')
  return {
    sha: ref.object.sha,
    treeSha: commit.tree.sha,
    tree: new Map(t.tree.filter(x => x.type === 'blob').map(x => [x.path, x.sha])),
  }
}

// Downloads and parses the archive at `head` (raw blobs). Returns null if there is none yet.
export async function readArchive (gh, head) {
  if (!head.tree.has(META)) return null
  const blob = path => api(gh.token, `${slot(gh)}/git/blobs/${head.tree.get(path)}`, { accept: 'application/vnd.github.raw+json', raw: true })
  const metaText = await blob(META)
  const paths = [...head.tree.keys()].filter(p => p.startsWith('snippets/') && p.endsWith('.txt'))
  const texts = new Map()
  let next = 0
  await Promise.all(Array.from({ length: Math.min(6, paths.length) }, async () => {
    while (next < paths.length) {
      const p = paths[next++]
      texts.set(p, await blob(p))
    }
  }))
  return deserialize(metaText, texts)
}

/* ---- push ---- */

// First commit into an empty repository (the Git Data API needs an existing commit).
async function bootstrap (gh) {
  const text = serialize({ folders: [], snippets: [], tombstones: [] }).get(META)
  const r = await api(gh.token, `${slot(gh)}/contents/${META}`, {
    method: 'PUT',
    body: { message: 'Initialize Note sync', content: btoa(text) },
  })
  return { sha: r.commit.sha, treeSha: r.commit.tree.sha, tree: new Map([[META, r.content.sha]]) }
}

// Commits `state` on top of `head`. Only changed files are sent; stale snippets/*.txt are removed;
// other files in the repo are left alone. Throws StaleError if the remote moved meanwhile.
// Returns the new head sha (or the old one when nothing changed).
export async function writeArchive (gh, head, state, message) {
  if (!head.sha) head = await bootstrap(gh)
  const files = serialize(state)
  const entries = []
  for (const [path, text] of files) {
    if (head.tree.get(path) === await gitSha(text)) continue
    if (text) entries.push({ path, mode: '100644', type: 'blob', content: text })
    else {
      const b = await api(gh.token, `${slot(gh)}/git/blobs`, { method: 'POST', body: { content: '', encoding: 'utf-8' } })
      entries.push({ path, mode: '100644', type: 'blob', sha: b.sha })
    }
  }
  for (const path of head.tree.keys()) {
    if (path.startsWith('snippets/') && path.endsWith('.txt') && !files.has(path)) {
      entries.push({ path, mode: '100644', type: 'blob', sha: null })
    }
  }
  if (!entries.length) return head.sha
  const tree = await api(gh.token, `${slot(gh)}/git/trees`, { method: 'POST', body: { base_tree: head.treeSha, tree: entries } })
  const commit = await api(gh.token, `${slot(gh)}/git/commits`, { method: 'POST', body: { message, tree: tree.sha, parents: [head.sha] } })
  try {
    await api(gh.token, `${slot(gh)}/git/refs/heads/${gh.repo.branch}`, { method: 'PATCH', body: { sha: commit.sha } })
  } catch (e) {
    if (e.status === 422) throw new StaleError('Remote changed during sync.')
    throw e
  }
  return commit.sha
}
