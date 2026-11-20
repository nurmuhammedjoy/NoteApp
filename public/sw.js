// Offline shell for the installed app. Static assets are cached on first use;
// navigations go to the network first and fall back to the cached app shell.
const CACHE = 'note-v1'
const CORE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/maskable-512.png',
  '/apple-touch-icon.png',
  '/fonts.css',
]

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', event => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // GitHub API and other services stay untouched

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok) {
            const copy = res.clone()
            event.waitUntil(caches.open(CACHE).then(cache => cache.put('/index.html', copy)))
          }
          return res
        })
        .catch(async () => (await caches.match('/index.html')) || (await caches.match('/')) || new Response('Offline', { status: 503 })),
    )
    return
  }

  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req)
        .then(res => {
          if (res.ok) {
            const copy = res.clone()
            event.waitUntil(caches.open(CACHE).then(cache => cache.put(req, copy)))
          }
          return res
        })
        .catch(() => cached || new Response('Offline', { status: 503 }))
      if (cached) {
        event.waitUntil(network.catch(() => {}))
        return cached
      }
      return network
    }),
  )
})
