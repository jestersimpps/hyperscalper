import { create } from 'zustand';
import type { ScanResult, ScannerStatus } from '@/models/Scanner';
import type { HyperliquidService } from '@/lib/services/hyperliquid.service';
import { ScannerService } from '@/lib/services/scanner.service';
import { useSettingsStore } from './useSettingsStore';
import { useTopSymbolsStore } from './useTopSymbolsStore';
import { playNotificationSound } from '@/lib/sound-utils';

interface ScannerStore {
  results: ScanResult[];
  status: ScannerStatus;
  intervalId: NodeJS.Timeout | null;
  previousSymbols: Set<string>;
  service: HyperliquidService | null;
  scannerService: ScannerService | null;
  setService: (service: HyperliquidService) => void;
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
  service: null,
  scannerService: null,

  setService: (service: HyperliquidService) => {
    set({
      service,
      scannerService: new ScannerService(service)
    });
  },

  runScan: async () => {
    const { status, scannerService } = get();
    if (status.isScanning) return;

    if (!scannerService) {
      console.warn('Scanner service not initialized');
      return;
    }

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

      const topSymbolsStore = useTopSymbolsStore.getState();
      const symbols = topSymbolsStore.symbols
        .slice(0, settings.topMarkets)
        .map(s => s.name);

      if (symbols.length === 0) {
        set({
          status: {
            ...get().status,
            isScanning: false,
            lastScanTime: Date.now(),
            error: 'No symbols available to scan',
          },
        });
        return;
      }

      const newResults: ScanResult[] = [];

      if (settings.stochasticScanner.enabled) {
        const stochResults = await scannerService.scanMultipleSymbols(symbols, {
          timeframes: settings.stochasticScanner.timeframes,
          config: settings.stochasticScanner,
          variants: indicatorSettings.stochastic.variants,
        });
        newResults.push(...stochResults);
      }

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
