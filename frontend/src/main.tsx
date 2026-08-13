import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'

// Register the PWA Service Worker
registerSW({
  immediate: true,
  onNeedRefresh() {
    // Versi baru terdeteksi → langsung reload
    window.location.reload()
  },
  onOfflineReady() {
    console.log('PWA: App is ready for offline use')
  },
  onRegistered(r) {
    console.log('SW Registered: ', r)
    // Cek update setiap 1 menit
    if (r) {
      setInterval(() => {
        r.update()
      }, 60 * 1000)
    }
  },
  onRegisterError(error) {
    console.log('SW Registration Error', error)
  }
})

// Dengarkan pesan dari Service Worker yang baru aktif
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'SW_UPDATED') {
      window.location.reload()
    }
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
