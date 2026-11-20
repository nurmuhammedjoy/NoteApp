// GitHub sign-in: a pasted personal access token.
// The token is stored only in the IndexedDB `meta` store (record key 'github').
import { deleteMeta, getMeta, putMeta } from '../db.js'

export class AuthError extends Error {}

// Validates the token, then stores it. Keeps the chosen repo when re-authenticating.
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

// Token-free view for the UI.
export async function getSession () {
  const g = await getMeta('github')
  return g?.token ? { user: g.user, repo: g.repo, lastSyncAt: g.lastSyncAt } : null
}

// Called when GitHub answers 401: forget the token, keep repo + sync state for the re-login.
export async function dropToken () {
  const g = await getMeta('github')
  if (g) await putMeta({ ...g, token: null })
}

export const signOut = () => deleteMeta('github')
