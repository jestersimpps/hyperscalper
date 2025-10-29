import { create } from 'zustand';
import type { ScanResult, ScannerStatus } from '@/models/Scanner';
import { useSettingsStore } from './useSettingsStore';

interface ScannerStore {
  results: ScanResult[];
  status: ScannerStatus;
  intervalId: NodeJS.Timeout | null;
  runScan: () => Promise<void>;
  startAutoScan: () => void;
  stopAutoScan: () => void;
  clearResults: () => void;
}

export const useScannerStore = create<ScannerStore>((set, get) => ({
  results: [],
  status: {
    isRunning: false,
    isScanning: false,
    lastScanTime: null,
    error: null,
  },
  intervalId: null,

  runScan: async () => {
    const { status } = get();
    if (status.isScanning) return;

    set({
      status: {
        ...status,
        isScanning: true,
        error: null,
      },
    });

    try {
      const settings = useSettingsStore.getState().settings.scanner;

      if (!settings.stochasticScanner.enabled) {
        set({
          status: {
            ...get().status,
            isScanning: false,
            lastScanTime: Date.now(),
          },
        });
        return;
      }

      const params = new URLSearchParams({
        timeframes: settings.stochasticScanner.timeframes.join(','),
        oversoldThreshold: settings.stochasticScanner.oversoldThreshold.toString(),
        overboughtThreshold: settings.stochasticScanner.overboughtThreshold.toString(),
        period: settings.stochasticScanner.period.toString(),
        smoothK: settings.stochasticScanner.smoothK.toString(),
        smoothD: settings.stochasticScanner.smoothD.toString(),
        topMarkets: settings.topMarkets.toString(),
        mode: settings.stochasticScanner.mode,
      });

      const response = await fetch(`/api/scanner?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch scanner results');
      }

      const data = await response.json();

      set({
        results: data.results || [],
        status: {
          ...get().status,
          isScanning: false,
          lastScanTime: Date.now(),
          error: null,
        },
      });
    } catch (error) {
      console.error('Scanner error:', error);
      set({
        status: {
          ...get().status,
          isScanning: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  },

  startAutoScan: () => {
    const { intervalId, status } = get();

    if (status.isRunning) return;

    get().runScan();

    const settings = useSettingsStore.getState().settings.scanner;
    const intervalMs = settings.scanInterval * 60 * 1000;

    const newIntervalId = setInterval(() => {
      get().runScan();
    }, intervalMs);

    set({
      intervalId: newIntervalId,
      status: {
        ...status,
        isRunning: true,
      },
    });
  },

  stopAutoScan: () => {
    const { intervalId, status } = get();

    if (intervalId) {
      clearInterval(intervalId);
    }

    set({
      intervalId: null,
      status: {
        ...status,
        isRunning: false,
      },
    });
  },

  clearResults: () => {
    set({ results: [] });
  },
}));
