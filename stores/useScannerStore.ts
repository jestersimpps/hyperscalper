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

      if (!settings.stochasticScanner.enabled && !settings.emaAlignmentScanner.enabled && !settings.channelScanner.enabled && !settings.divergenceScanner.enabled && !settings.macdReversalScanner.enabled && !settings.rsiReversalScanner.enabled) {
        set({
          status: {
            ...get().status,
            isScanning: false,
            lastScanTime: Date.now(),
          },
        });
        return;
      }

      const stochVariants = indicatorSettings.stochastic.variants;

      const body = {
        stochasticEnabled: settings.stochasticScanner.enabled,
        oversoldThreshold: settings.stochasticScanner.oversoldThreshold,
        overboughtThreshold: settings.stochasticScanner.overboughtThreshold,
        stochasticTimeframes: settings.stochasticScanner.timeframes,
        stochasticVariants: {
          fast9: {
            enabled: stochVariants.fast9.enabled,
            period: stochVariants.fast9.period,
            smoothK: stochVariants.fast9.smoothK,
            smoothD: stochVariants.fast9.smoothD,
          },
          fast14: {
            enabled: stochVariants.fast14.enabled,
            period: stochVariants.fast14.period,
            smoothK: stochVariants.fast14.smoothK,
            smoothD: stochVariants.fast14.smoothD,
          },
          fast40: {
            enabled: stochVariants.fast40.enabled,
            period: stochVariants.fast40.period,
            smoothK: stochVariants.fast40.smoothK,
            smoothD: stochVariants.fast40.smoothD,
          },
          full60: {
            enabled: stochVariants.full60.enabled,
            period: stochVariants.full60.period,
            smoothK: stochVariants.full60.smoothK,
            smoothD: stochVariants.full60.smoothD,
          },
        },
        topMarkets: settings.topMarkets,
        emaAlignmentEnabled: settings.emaAlignmentScanner.enabled,
        emaTimeframes: settings.emaAlignmentScanner.timeframes,
        ema1Period: settings.emaAlignmentScanner.ema1Period,
        ema2Period: settings.emaAlignmentScanner.ema2Period,
        ema3Period: settings.emaAlignmentScanner.ema3Period,
        emaLookbackBars: settings.emaAlignmentScanner.lookbackBars,
        channelEnabled: settings.channelScanner.enabled,
        channelTimeframes: settings.channelScanner.timeframes,
        channelMinTouches: settings.channelScanner.minTouches,
        channelPivotStrength: settings.channelScanner.pivotStrength,
        channelLookbackBars: settings.channelScanner.lookbackBars,
        divergenceEnabled: settings.divergenceScanner.enabled,
        divergenceScanBullish: settings.divergenceScanner.scanBullish,
        divergenceScanBearish: settings.divergenceScanner.scanBearish,
        divergenceScanHidden: settings.divergenceScanner.scanHidden,
        divergencePivotStrength: settings.divergenceScanner.pivotStrength,
        divergenceTimeframes: settings.divergenceScanner.timeframes,
        macdReversalEnabled: settings.macdReversalScanner.enabled,
        macdTimeframes: settings.macdReversalScanner.timeframes,
        macdFastPeriod: settings.macdReversalScanner.fastPeriod,
        macdSlowPeriod: settings.macdReversalScanner.slowPeriod,
        macdSignalPeriod: settings.macdReversalScanner.signalPeriod,
        macdRecentReversalLookback: settings.macdReversalScanner.recentReversalLookback,
        macdMinCandles: settings.macdReversalScanner.minCandles,
        rsiReversalEnabled: settings.rsiReversalScanner.enabled,
        rsiTimeframes: settings.rsiReversalScanner.timeframes,
        rsiPeriod: settings.rsiReversalScanner.period,
        rsiOversoldLevel: settings.rsiReversalScanner.oversoldLevel,
        rsiOverboughtLevel: settings.rsiReversalScanner.overboughtLevel,
        rsiRecentReversalLookback: settings.rsiReversalScanner.recentReversalLookback,
        rsiMinCandles: settings.rsiReversalScanner.minCandles,
      };

      throw new Error('Scanner functionality is currently unavailable. Client-side implementation in progress.');

      const newResults = [];
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
