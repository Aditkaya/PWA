/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { clientsClaim, skipWaiting } from 'workbox-core'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { NetworkFirst, CacheFirst } from 'workbox-strategies'

declare let self: ServiceWorkerGlobalScope

// ── Versi SW – naikkan angka ini setiap deploy untuk paksa update cache ──────
// v5: auto self-healing and instant background client refresh
const SW_VERSION = 'v5'

// Langsung aktifkan SW baru tanpa menunggu tab ditutup
skipWaiting()
clientsClaim()

// Bersihkan cache lama yang sudah tidak dipakai (termasuk cache rusak)
cleanupOutdatedCaches()

// Cache semua file yang di-generate oleh Vite (JS/CSS dengan hash)
precacheAndRoute(self.__WB_MANIFEST)

// ── Pada aktivasi: hapus SEMUA cache lama lalu reload semua tab user ─────────
self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      // 1. Hapus SEMUA cache yang ada (termasuk cache rusak/lama)
      const cacheNames = await caches.keys()
      await Promise.all(cacheNames.map(name => caches.delete(name)))

      // 2. Ambil alih semua client (tab/window) yang terbuka
      await self.clients.claim()

      // 3. Reload paksa semua tab yang sedang buka app ini
      //    --> HP user tidak perlu melakukan apapun, halaman reload sendiri
      const allClients = await self.clients.matchAll({
        includeUncontrolled: true,
        type: 'window',
      })
      for (const client of allClients) {
        try {
          client.postMessage({ type: 'SW_ACTIVATED' })
          client.navigate(client.url)
        } catch (_) {}
      }
    })()
  )
})

// ── Navigation: NetworkFirst agar index.html selalu ambil dari server ─────────
registerRoute(
  new NavigationRoute(
    new NetworkFirst({
      cacheName: `pwa-navigation-${SW_VERSION}`,
      networkTimeoutSeconds: 5,
    })
  )
)

// ── API calls: selalu dari network ───────────────────────────────────────────
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({ cacheName: `pwa-api-${SW_VERSION}` })
)

// ── Static assets (JS/CSS dengan content hash): CacheFirst ──────────────────
registerRoute(
  ({ url }) => url.pathname.startsWith('/assets/'),
  new CacheFirst({ cacheName: `pwa-assets-${SW_VERSION}` })
)
