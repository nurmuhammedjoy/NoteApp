// sign in to github with a pasted access token
// the token is stored in the indexed db meta store
import { deleteMeta, getMeta, putMeta } from '../db.js'

export class AuthError extends Error {}

// validate and store the token while keeping the chosen repo
export async function completeSignIn (token) {
  const res = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  })
  if (res.status === 401) throw new Error('GitHub rejected that token.')
  if (!res.ok) throw new Error(`GitHub error ${res.status}.`)
  const u = await res.json()
  const prev = await getMeta('github')
  await putMeta({
    lastSyncAt: 0,
    lastSyncSha: null,
    ...prev,
    key: 'github',
    token,
    user: { login: u.login, name: u.name || u.login },
    repo: prev?.repo ?? null,
  })
}

// return token details without the token
export async function getSession () {
  const g = await getMeta('github')
  return g?.token ? { user: g.user, repo: g.repo, lastSyncAt: g.lastSyncAt } : null
}

// when github returns 401 forget the token and keep repo and sync state
export async function dropToken () {
  const g = await getMeta('github')
  if (g) await putMeta({ ...g, token: null })
}

export const signOut = () => deleteMeta('github')
