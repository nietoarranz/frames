/* global self, caches, fetch, URL */
// Offline support. The build fills in the precache list and version (see
// vite.config.ts), so every deploy installs a fresh worker and cache.

const VERSION = __VERSION__
const PRECACHE = __PRECACHE__
const CACHE = `frames-${VERSION}`

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("frames-") && key !== CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return
  }

  // Pages: network first so deploys show up, cached shell when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            void caches.open(CACHE).then((cache) => cache.put("/", copy))
          }
          return response
        })
        .catch(() => caches.match("/", { ignoreVary: true }))
    )
    return
  }

  // Everything else: cache first, filling the cache on a miss. Vary is
  // ignored because precached entries were fetched without an Origin header.
  event.respondWith(
    caches.match(request, { ignoreVary: true }).then(
      (cached) =>
        cached ??
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone()
            void caches.open(CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        })
    )
  )
})
