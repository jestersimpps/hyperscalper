import { create } from 'zustand';

export type CrosshairType = 'cloud-long' | 'cloud-short' | 'sm-long' | 'sm-short' | 'big-long' | 'big-short' | 'exit-25' | 'exit-50' | 'exit-75' | 'exit-100' | null;

interface CrosshairStore {
  active: boolean;
  type: CrosshairType;
  setMode: (type: CrosshairType) => void;
  reset: () => void;
}

export const useCrosshairStore = create<CrosshairStore>((set) => ({
  active: false,
  type: null,
  setMode: (type) => set({ active: type !== null, type }),
  reset: () => set({ active: false, type: null }),
}));
