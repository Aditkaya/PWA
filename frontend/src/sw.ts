import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'

declare const self: any

// Hapus cache versi lama secara otomatis
cleanupOutdatedCaches()

// Cache semua file yang di-generate oleh Vite
precacheAndRoute(self.__WB_MANIFEST)

// KUNCI UTAMA: Paksa Service Worker baru untuk LANGSUNG aktif
// tanpa menunggu tab lama ditutup
self.skipWaiting()

// Ambil alih semua halaman/tab yang sudah terbuka
self.addEventListener('activate', (event: any) => {
  event.waitUntil(self.clients.claim())
})

// Ketika SW baru aktif, beritahu semua tab untuk reload
self.addEventListener('activate', () => {
  self.clients.matchAll({ type: 'window' }).then((clients: any[]) => {
    clients.forEach((client: any) => {
      client.postMessage({ type: 'SW_UPDATED' })
    })
  })
})
