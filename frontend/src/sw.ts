/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches, matchPrecache } from 'workbox-precaching'
import { clientsClaim, skipWaiting } from 'workbox-core'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare let self: ServiceWorkerGlobalScope

skipWaiting()
clientsClaim()
cleanupOutdatedCaches()

// Serve a fresh page online, then fall back to the installed shell offline.
// If Safari evicts its cache, an online navigation can still recover.
precacheAndRoute(self.__WB_MANIFEST)
registerRoute(new NavigationRoute(async ({ request }) => {
  let networkResponse: Response | undefined
  try {
    networkResponse = await fetch(request)
    if (networkResponse.ok) return networkResponse
  } catch {
    // Try the precached shell below.
  }
  return await matchPrecache('/index.html') || networkResponse || Response.error()
}))

// API responses are never cached. Attendance submissions use IndexedDB.
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(names => Promise.all(
    names.filter(name => name.startsWith('pwa-api-') || name.startsWith('pwa-navigation-'))
      .map(name => caches.delete(name))
  )))
})
