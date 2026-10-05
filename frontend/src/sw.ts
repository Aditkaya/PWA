/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { clientsClaim, skipWaiting } from 'workbox-core'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { NetworkFirst, CacheFirst } from 'workbox-strategies'

declare let self: ServiceWorkerGlobalScope

// ── Versi SW – naikkan angka ini setiap deploy untuk paksa update cache ──────
const SW_VERSION = 'v2'

// Langsung aktifkan SW baru tanpa menunggu tab ditutup
skipWaiting()
clientsClaim()

// Bersihkan cache lama yang sudah tidak dipakai (termasuk cache rusak)
cleanupOutdatedCaches()

// Cache semua file yang di-generate oleh Vite (JS/CSS dengan hash)
precacheAndRoute(self.__WB_MANIFEST)

// ── Pada aktivasi: hapus SEMUA cache lama agar white screen tidak berlanjut ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(async (names) => {
      for (const name of names) {
        // Hapus semua cache yang bukan precache workbox saat ini
        // agar respons rusak (HTML-as-JS) tidak tersimpan di cache
        if (
          name.startsWith('aypsis-face-models-v') ||
          name.startsWith('workbox-precache') && !name.includes(SW_VERSION)
        ) {
          await caches.delete(name)
        }
      }
    })
  )
})

// ── Navigation: gunakan NetworkFirst agar index.html selalu fresh ─────────────
// Jika network gagal (offline), fallback ke cache
registerRoute(
  new NavigationRoute(
    new NetworkFirst({
      cacheName: `pwa-navigation-${SW_VERSION}`,
      networkTimeoutSeconds: 5,
    })
  )
)

// ── API calls: selalu dari network, tidak pernah dari cache ──────────────────
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({ cacheName: `pwa-api-${SW_VERSION}` })
)

// ── Static assets (JS/CSS dengan hash): CacheFirst karena hash berubah tiap build ─
registerRoute(
  ({ url }) => url.pathname.startsWith('/assets/'),
  new CacheFirst({ cacheName: `pwa-assets-${SW_VERSION}` })
)

// Migration to server inference: remove only this app's obsolete model caches.
// (sudah ditangani di activate listener di atas)
