import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { clientsClaim, skipWaiting } from 'workbox-core'

declare let self: ServiceWorkerGlobalScope

// Langsung aktifkan SW baru tanpa menunggu tab ditutup
skipWaiting()
clientsClaim()

// Bersihkan cache lama yang sudah tidak dipakai
cleanupOutdatedCaches()

// Cache semua file yang di-generate oleh Vite
precacheAndRoute(self.__WB_MANIFEST)
