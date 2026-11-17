// GitHub sign-in: OAuth Device Flow (no client secret) or a pasted access token.
// The token is stored only in the IndexedDB `meta` store (record key 'github').
import { deleteMeta, getMeta, putMeta } from '../db.js'

// Public client id of your GitHub OAuth App (Settings > Developer settings > OAuth Apps),
// with "Enable Device Flow" ticked. Not a secret.
export const CLIENT_ID = 'Ov23libyW7mWGEGLDe4F'

// github.com does not send CORS headers for the device-flow endpoints, so a browser cannot read
// their responses directly. Set this to the URL of your deployed forwarder in cloudflare/
// (e.g. 'https://gh-auth-forwarder.<you>.workers.dev'), which relays
// POST /login/device/code and POST /login/oauth/access_token to https://github.com.
export const AUTH_BASE = ''

export class AuthError extends Error {}

const form = body => ({
  method: 'POST',
  headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams(body),
})

const sleep = (ms, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'))
  const t = setTimeout(resolve, ms)
  signal?.addEventListener('abort', () => {
    clearTimeout(t)
    reject(new DOMException('Aborted', 'AbortError'))
  }, { once: true })
})

export async function startDeviceFlow () {
  if (!CLIENT_ID) throw new Error('Set CLIENT_ID in src/github/auth.js first.')
  if (!AUTH_BASE) throw new Error('Set AUTH_BASE in src/github/auth.js to your forwarder URL (see cloudflare/README first).')
  const res = await fetch(`${AUTH_BASE}/login/device/code`, form({ client_id: CLIENT_ID, scope: 'repo' }))
  const d = await res.json().catch(() => ({}))
  if (!res.ok || d.error) throw new Error(d.error_description || d.error || 'Could not start sign-in.')
  return {
    deviceCode: d.device_code,
    userCode: d.user_code,
    verificationUri: d.verification_uri,
    interval: d.interval || 5,
    expiresAt: Date.now() + d.expires_in * 1000,
  }
}

// Resolves with the access token. Rejects on denial/expiry, or with AbortError when cancelled.
export async function pollForToken (flow, signal) {
  let wait = flow.interval
  for (;;) {
    await sleep(wait * 1000, signal)
    if (Date.now() > flow.expiresAt) throw new Error('The code expired. Start again.')
    let d
    try {
      const res = await fetch(`${AUTH_BASE}/login/oauth/access_token`, {
        ...form({
          client_id: CLIENT_ID,
          device_code: flow.deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        }),
        signal,
      })
      d = await res.json()
    } catch (e) {
      if (signal?.aborted) throw e
      continue // transient network error: keep polling until the code expires
    }
    if (d.access_token) return d.access_token
    if (d.error === 'authorization_pending') continue
    if (d.error === 'slow_down') wait = d.interval || wait + 5
    else if (d.error === 'expired_token') throw new Error('The code expired. Start again.')
    else if (d.error === 'access_denied') throw new Error('Sign-in was denied.')
    else throw new Error(d.error_description || d.error || 'Sign-in failed.')
  }
}

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
