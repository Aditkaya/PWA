import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { clientsClaim, skipWaiting } from 'workbox-core'

declare let self: any

// Langsung aktifkan SW baru tanpa menunggu tab ditutup
skipWaiting()
clientsClaim()

// Bersihkan cache lama yang sudah tidak dipakai
cleanupOutdatedCaches()

// Cache semua file yang di-generate oleh Vite
precacheAndRoute(self.__WB_MANIFEST)

// Listen untuk Web Push Notification
self.addEventListener('push', (event: any) => {
  if (event.data) {
    const data = event.data.json();
    const title = data.title || 'Notifikasi Baru';
    const options = {
      body: data.body,
      icon: data.icon || '/logo-kotak.png',
      badge: '/logo-kotak.png',
      data: {
        url: data.url || '/'
      }
    };
    
    event.waitUntil(self.registration.showNotification(title, options));
  }
});

// Listen klik pada notifikasi
self.addEventListener('notificationclick', (event: any) => {
  event.notification.close();
  const urlToOpen = event.notification.data.url;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients: any) => {
      // Jika ada tab yang terbuka, fokus ke sana
      for (let client of windowClients) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // Jika tidak ada tab yang terbuka, buka tab baru
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
