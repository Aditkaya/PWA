import { create } from 'zustand'

const STORAGE_KEY = 'pwa-snow-enabled'
const readPreference = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved !== null) return saved !== 'false'
  } catch { /* The effect can still be toggled when storage is unavailable. */ }
  return false
}

export const useSnowStore = create<{ enabled: boolean; toggle: () => void }>((set) => ({
  enabled: readPreference(),
  toggle: () => set(state => {
    const enabled = !state.enabled
    try { localStorage.setItem(STORAGE_KEY, String(enabled)) } catch { /* Keep the in-memory preference. */ }
    return { enabled }
  }),
}))
