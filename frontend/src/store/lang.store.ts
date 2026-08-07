import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Language = 'id' | 'en'

interface LangState {
  lang: Language
  setLang: (lang: Language) => void
  toggleLang: () => void
}

export const useLangStore = create<LangState>()(
  persist(
    (set) => ({
      lang: 'id',
      setLang: (lang) => set({ lang }),
      toggleLang: () => set((state) => ({ lang: state.lang === 'id' ? 'en' : 'id' })),
    }),
    {
      name: 'lang-storage',
    }
  )
)
