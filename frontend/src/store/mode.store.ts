import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ModeState {
  isOvertimeMode: boolean;
  toggleOvertimeMode: () => void;
}

export const useModeStore = create<ModeState>()(
  persist(
    (set) => ({
      isOvertimeMode: false,
      toggleOvertimeMode: () => set((state) => ({ isOvertimeMode: !state.isOvertimeMode })),
    }),
    {
      name: 'mode-storage',
    }
  )
);
