import { precacheAndRoute } from 'workbox-precaching'

declare let self: ServiceWorkerGlobalScope

// Cache semua file yang di-generate oleh Vite
precacheAndRoute(self.__WB_MANIFEST)

