import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'

// Auto-reload when new service worker takes control
let isRefreshing = false;
navigator.serviceWorker?.addEventListener('controllerchange', () => {
  if (!isRefreshing) {
    isRefreshing = true;
    window.location.reload();
  }
});

// Register the PWA Service Worker with immediate auto-update
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // Auto-update immediately so all users get the fresh version automatically
    updateSW(true);
  },
  onOfflineReady() {
    console.log('PWA: App is ready for offline use');
  },
  onRegistered(r) {
    console.log('SW Registered: ', r);
    // Proactively check for updates every 15 minutes
    if (r) {
      setInterval(() => {
        r.update();
      }, 15 * 60 * 1000);
    }
  },
  onRegisterError(error) {
    console.log('SW Registration Error', error);
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
