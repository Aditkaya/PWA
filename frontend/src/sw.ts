/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { clientsClaim, skipWaiting } from 'workbox-core'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare let self: ServiceWorkerGlobalScope

skipWaiting()
clientsClaim()
cleanupOutdatedCaches()

// Keep the app shell available after the first online visit.
precacheAndRoute(self.__WB_MANIFEST)
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')))

// API responses are never cached. Attendance submissions use IndexedDB.
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(names => Promise.all(
    names.filter(name => name.startsWith('pwa-api-') || name.startsWith('pwa-navigation-'))
      .map(name => caches.delete(name))
  )))
})
