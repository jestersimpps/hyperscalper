import { create } from 'zustand';
import type { ScanResult, ScannerStatus } from '@/models/Scanner';
import { useSettingsStore } from './useSettingsStore';
import { playNotificationSound } from '@/lib/sound-utils';

interface ScannerStore {
  results: ScanResult[];
  status: ScannerStatus;
  intervalId: NodeJS.Timeout | null;
  previousSymbols: Set<string>;
  runScan: () => Promise<void>;
  startAutoScan: () => void;
  startAutoScanWithDelay: () => void;
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
  previousSymbols: new Set(),

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
      const indicatorSettings = useSettingsStore.getState().settings.indicators;

      if (!settings.stochasticScanner.enabled && !settings.emaAlignmentScanner.enabled) {
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
        stochasticEnabled: settings.stochasticScanner.enabled.toString(),
        timeframes: settings.stochasticScanner.timeframes.join(','),
        oversoldThreshold: settings.stochasticScanner.oversoldThreshold.toString(),
        overboughtThreshold: settings.stochasticScanner.overboughtThreshold.toString(),
        period: settings.stochasticScanner.period.toString(),
        smoothK: settings.stochasticScanner.smoothK.toString(),
        smoothD: settings.stochasticScanner.smoothD.toString(),
        topMarkets: settings.topMarkets.toString(),
        emaAlignmentEnabled: settings.emaAlignmentScanner.enabled.toString(),
        emaTimeframes: settings.emaAlignmentScanner.timeframes.join(','),
        ema1Period: indicatorSettings.ema.ema1.period.toString(),
        ema2Period: indicatorSettings.ema.ema2.period.toString(),
        ema3Period: indicatorSettings.ema.ema3.period.toString(),
        emaLookbackBars: settings.emaAlignmentScanner.lookbackBars.toString(),
      });

      const response = await fetch(`/api/scanner?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch scanner results');
      }

      const data = await response.json();

      const newResults = data.results || [];
      const newSymbols = new Set(newResults.map((r: ScanResult) => r.symbol));

      if (newResults.length > 0 && settings.playSound) {
        const firstResult = newResults[0];
        console.log(`[Scanner] Scan completed with ${newResults.length} result(s): ${newResults.map(r => r.symbol).join(', ')} - Playing sound`);
        playNotificationSound(firstResult.signalType).catch(err =>
          console.error('Error playing sound:', err)
        );
      } else if (settings.playSound) {
        console.log('[Scanner] Scan completed with no results - skipping sound');
      } else {
        console.log('[Scanner] Sound disabled in settings');
      }

      set({
        results: newResults,
        previousSymbols: newSymbols,
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

  startAutoScanWithDelay: () => {
    const { intervalId, status } = get();

    if (status.isRunning) return;

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
    set({ results: [], previousSymbols: new Set() });
  },
}));
