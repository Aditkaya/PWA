import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'

// Register the PWA Service Worker with update detection
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // Fire a custom event so any component can listen and show a notification
    window.dispatchEvent(new CustomEvent('pwa-update-available', { detail: { updateSW } }));
  },
  onOfflineReady() {
    console.log('PWA: App is ready for offline use');
  },
  onRegistered(r) {
    console.log('SW Registered: ', r);
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
