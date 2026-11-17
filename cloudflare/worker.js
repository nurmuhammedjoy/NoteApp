// CORS forwarder for the GitHub OAuth device flow.
//
// github.com/login/device/code and github.com/login/oauth/access_token do not send CORS
// headers, so a browser app cannot read their responses. This worker relays exactly those
// two POSTs to https://github.com and adds CORS headers so the app can call it directly.
//
// Deploy: https://developers.cloudflare.com/workers/get-started/guide/
//   1. npm i -g wrangler && wrangler login
//   2. wrangler deploy          (from this directory; see wrangler.toml)
//   3. Put the printed URL (e.g. https://gh-auth-forwarder.<you>.workers.dev)
//      into AUTH_BASE in src/github/auth.js.
//
// Hardening (recommended, optional): uncomment the vars in wrangler.toml, then only your
// app's origin is allowed and only your OAuth App's client_id is relayed.

const GITHUB = 'https://github.com'

// Only these device-flow endpoints are relayed. Everything else gets a 404, so the
// worker is not a general-purpose open proxy.
const PATHS = new Set(['/login/device/code', '/login/oauth/access_token'])

// CORS headers browsers require before sending the POST.
const cors = origin => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin',
})

export default {
  async fetch (request, env) {
    const origin = request.headers.get('Origin')
    // ALLOWED_ORIGIN in wrangler.toml locks responses to your app; empty means allow all.
    const allow = env.ALLOWED_ORIGIN || origin || '*'
    const headers = cors(allow)

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })

    const { pathname } = new URL(request.url)
    if (!PATHS.has(pathname)) return new Response('Not found', { status: 404, headers })

    // If CLIENT_ID is set, refuse to relay bodies claiming another OAuth App.
    const body = await request.text()
    if (env.CLIENT_ID) {
      const form = new URLSearchParams(body)
      if (form.get('client_id') !== env.CLIENT_ID) {
        return new Response(JSON.stringify({ error: 'client_id_mismatch' }), {
          status: 403,
          headers: { ...headers, 'Content-Type': 'application/json' },
        })
      }
    }

    const upstream = await fetch(GITHUB + pathname, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        // Do not forward browser headers like cookies; GitHub needs only the form body.
      },
      body,
    })

    // GitHub answers application/json because of the Accept header; pass it through as-is
    // but strip its headers so only ours (CORS, status) reach the browser.
    const text = await upstream.text()
    return new Response(text, { status: upstream.status, headers: { ...headers, 'Content-Type': 'application/json' } })
  },
}
