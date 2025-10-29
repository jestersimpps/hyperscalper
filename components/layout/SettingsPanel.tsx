'use client';

import { useEffect, useCallback, useState } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { StochasticTimeframeConfig, EmaConfig } from '@/models/Settings';

export default function SettingsPanel() {
  const { isPanelOpen, activeTab, closePanel, setActiveTab, settings, updateStochasticSettings, updateEmaSettings, updateMacdSettings, updateScannerSettings, updateOrderSettings } = useSettingsStore();
  const [isStochasticExpanded, setIsStochasticExpanded] = useState(false);
  const [isEmaExpanded, setIsEmaExpanded] = useState(false);
  const [isMacdExpanded, setIsMacdExpanded] = useState(false);
  const [isScannerStochExpanded, setIsScannerStochExpanded] = useState(false);
  const [isScannerEmaExpanded, setIsScannerEmaExpanded] = useState(false);

  const handleBackdropClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      closePanel();
    }
  }, [closePanel]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isPanelOpen) {
        closePanel();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isPanelOpen, closePanel]);

  if (!isPanelOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-end p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={handleBackdropClick}
    >
      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slide-in {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>

      <div className="terminal-border bg-bg-primary w-[600px] max-h-[80vh] flex flex-col animate-slide-in">
        {/* Header */}
        <div className="p-4 border-b border-frame flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-primary text-lg">⚙</span>
            <h2 className="text-primary text-sm font-bold uppercase tracking-wider">Settings</h2>
          </div>
          <button
            onClick={closePanel}
            className="text-primary-muted hover:text-primary transition-colors text-xl leading-none"
            title="Close settings"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-frame bg-bg-secondary">
          <button
            onClick={() => setActiveTab('scanner')}
            className={`flex-1 px-4 py-3 text-xs font-mono uppercase tracking-wider transition-all ${
              activeTab === 'scanner'
                ? 'bg-primary/10 text-primary border-b-2 border-primary'
                : 'text-primary-muted hover:text-primary hover:bg-primary/5'
            }`}
          >
            █ Scanner
          </button>
          <button
            onClick={() => setActiveTab('indicators')}
            className={`flex-1 px-4 py-3 text-xs font-mono uppercase tracking-wider transition-all ${
              activeTab === 'indicators'
                ? 'bg-primary/10 text-primary border-b-2 border-primary'
                : 'text-primary-muted hover:text-primary hover:bg-primary/5'
            }`}
          >
            █ Indicators
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`flex-1 px-4 py-3 text-xs font-mono uppercase tracking-wider transition-all ${
              activeTab === 'orders'
                ? 'bg-primary/10 text-primary border-b-2 border-primary'
                : 'text-primary-muted hover:text-primary hover:bg-primary/5'
            }`}
          >
            █ Orders
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'scanner' && (
            <div className="space-y-3">
              <div className="p-3 bg-bg-secondary border border-frame rounded">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-primary-muted text-xs font-mono">ENABLE SCANNER</span>
                  <input
                    type="checkbox"
                    checked={settings.scanner.enabled}
                    onChange={(e) => updateScannerSettings({ enabled: e.target.checked })}
                    className="w-4 h-4 accent-primary cursor-pointer"
                  />
                </label>
              </div>

              {settings.scanner.enabled && (
                <>
                  <div className="p-3 bg-bg-secondary border border-frame rounded space-y-3">
                    <div>
                      <label className="text-primary-muted font-mono block mb-1 text-xs">SCAN INTERVAL (MINUTES)</label>
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={settings.scanner.scanInterval}
                        onChange={(e) => updateScannerSettings({ scanInterval: Number(e.target.value) })}
                        className="w-full bg-bg-primary border border-frame text-primary px-2 py-1 rounded font-mono text-xs"
                      />
                    </div>

                    <div>
                      <label className="text-primary-muted font-mono block mb-1 text-xs">TOP MARKETS TO SCAN</label>
                      <input
                        type="number"
                        min="5"
                        max="100"
                        value={settings.scanner.topMarkets}
                        onChange={(e) => updateScannerSettings({ topMarkets: Number(e.target.value) })}
                        className="w-full bg-bg-primary border border-frame text-primary px-2 py-1 rounded font-mono text-xs"
                      />
                    </div>

                    <div>
                      <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-primary-muted text-xs font-mono">PLAY SOUND ON NEW RESULTS</span>
                        <input
                          type="checkbox"
                          checked={settings.scanner.playSound}
                          onChange={(e) => updateScannerSettings({ playSound: e.target.checked })}
                          className="w-4 h-4 accent-primary cursor-pointer"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="border border-frame rounded overflow-hidden">
                    <button
                      onClick={() => setIsScannerStochExpanded(!isScannerStochExpanded)}
                      className="w-full p-3 bg-bg-secondary flex items-center justify-between hover:bg-primary/5 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-primary font-mono text-xs font-bold">█ STOCHASTIC SCANNER</span>
                      </div>
                      <span className="text-primary text-sm">{isScannerStochExpanded ? '▼' : '▶'}</span>
                    </button>

                    {isScannerStochExpanded && (
                      <div className="p-4 space-y-4 bg-bg-primary">
                        <div className="p-3 bg-bg-secondary border border-frame rounded">
                          <label className="flex items-center justify-between cursor-pointer">
                            <span className="text-primary-muted text-xs font-mono">ENABLE STOCHASTIC SCANNER</span>
                            <input
                              type="checkbox"
                              checked={settings.scanner.stochasticScanner.enabled}
                              onChange={(e) =>
                                updateScannerSettings({
                                  stochasticScanner: {
                                    ...settings.scanner.stochasticScanner,
                                    enabled: e.target.checked,
                                  },
                                })
                              }
                              className="w-4 h-4 accent-primary cursor-pointer"
                            />
                          </label>
                        </div>

                        {settings.scanner.stochasticScanner.enabled && (
                          <>
                            <div className="p-3 bg-bg-secondary border border-frame rounded space-y-3">
                              <div className="text-primary font-mono text-xs font-bold mb-2">TIMEFRAMES TO SCAN</div>
                              <div className="grid grid-cols-2 gap-2">
                                {(['1m', '5m', '15m', '1h'] as const).map((tf) => (
                                  <label key={tf} className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={settings.scanner.stochasticScanner.timeframes.includes(tf)}
                                      onChange={(e) => {
                                        const newTimeframes = e.target.checked
                                          ? [...settings.scanner.stochasticScanner.timeframes, tf]
                                          : settings.scanner.stochasticScanner.timeframes.filter((t) => t !== tf);
                                        updateScannerSettings({
                                          stochasticScanner: {
                                            ...settings.scanner.stochasticScanner,
                                            timeframes: newTimeframes,
                                          },
                                        });
                                      }}
                                      className="w-4 h-4 accent-primary cursor-pointer"
                                    />
                                    <span className="text-primary-muted font-mono text-xs">{tf.toUpperCase()}</span>
                                  </label>
                                ))}
                              </div>
                            </div>

                            <div className="p-3 bg-bg-secondary border border-frame rounded">
                              <div className="text-primary font-mono text-xs font-bold mb-3">THRESHOLDS</div>
                              <div className="grid grid-cols-2 gap-3 text-xs">
                                <div>
                                  <label className="text-primary-muted font-mono block mb-1">OVERSOLD</label>
                                  <input
                                    type="number"
                                    min="0"
                                    max="50"
                                    value={settings.scanner.stochasticScanner.oversoldThreshold}
                                    onChange={(e) =>
                                      updateScannerSettings({
                                        stochasticScanner: {
                                          ...settings.scanner.stochasticScanner,
                                          oversoldThreshold: Number(e.target.value),
                                        },
                                      })
                                    }
                                    className="w-full bg-bg-primary border border-frame text-primary px-2 py-1 rounded font-mono text-xs"
                                  />
                                </div>
                                <div>
                                  <label className="text-primary-muted font-mono block mb-1">OVERBOUGHT</label>
                                  <input
                                    type="number"
                                    min="50"
                                    max="100"
                                    value={settings.scanner.stochasticScanner.overboughtThreshold}
                                    onChange={(e) =>
                                      updateScannerSettings({
                                        stochasticScanner: {
                                          ...settings.scanner.stochasticScanner,
                                          overboughtThreshold: Number(e.target.value),
                                        },
                                      })
                                    }
                                    className="w-full bg-bg-primary border border-frame text-primary px-2 py-1 rounded font-mono text-xs"
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="p-3 bg-bg-secondary border border-frame rounded">
                              <div className="text-primary font-mono text-xs font-bold mb-3">STOCHASTIC PARAMETERS</div>
                              <div className="grid grid-cols-3 gap-3 text-xs">
                                <div>
                                  <label className="text-primary-muted font-mono block mb-1">PERIOD</label>
                                  <input
                                    type="number"
                                    min="5"
                                    max="21"
                                    value={settings.scanner.stochasticScanner.period}
                                    onChange={(e) =>
                                      updateScannerSettings({
                                        stochasticScanner: {
                                          ...settings.scanner.stochasticScanner,
                                          period: Number(e.target.value),
                                        },
                                      })
                                    }
                                    className="w-full bg-bg-primary border border-frame text-primary px-2 py-1 rounded font-mono text-xs"
                                  />
                                </div>
                                <div>
                                  <label className="text-primary-muted font-mono block mb-1">SMOOTH K</label>
                                  <input
                                    type="number"
                                    min="1"
                                    max="5"
                                    value={settings.scanner.stochasticScanner.smoothK}
                                    onChange={(e) =>
                                      updateScannerSettings({
                                        stochasticScanner: {
                                          ...settings.scanner.stochasticScanner,
                                          smoothK: Number(e.target.value),
                                        },
                                      })
                                    }
                                    className="w-full bg-bg-primary border border-frame text-primary px-2 py-1 rounded font-mono text-xs"
                                  />
                                </div>
                                <div>
                                  <label className="text-primary-muted font-mono block mb-1">SMOOTH D</label>
                                  <input
                                    type="number"
                                    min="1"
                                    max="5"
                                    value={settings.scanner.stochasticScanner.smoothD}
                                    onChange={(e) =>
                                      updateScannerSettings({
                                        stochasticScanner: {
                                          ...settings.scanner.stochasticScanner,
                                          smoothD: Number(e.target.value),
                                        },
                                      })
                                    }
                                    className="w-full bg-bg-primary border border-frame text-primary px-2 py-1 rounded font-mono text-xs"
                                  />
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="border border-frame rounded overflow-hidden">
                    <button
                      onClick={() => setIsScannerEmaExpanded(!isScannerEmaExpanded)}
                      className="w-full p-3 bg-bg-secondary flex items-center justify-between hover:bg-primary/5 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-primary font-mono text-xs font-bold">█ EMA ALIGNMENT SCANNER</span>
                      </div>
                      <span className="text-primary text-sm">{isScannerEmaExpanded ? '▼' : '▶'}</span>
                    </button>

                    {isScannerEmaExpanded && (
                      <div className="p-4 space-y-4 bg-bg-primary">
                        <div className="p-3 bg-bg-secondary border border-frame rounded">
                          <label className="flex items-center justify-between cursor-pointer">
                            <span className="text-primary-muted text-xs font-mono">ENABLE EMA ALIGNMENT SCANNER</span>
                            <input
                              type="checkbox"
                              checked={settings.scanner.emaAlignmentScanner.enabled}
                              onChange={(e) =>
                                updateScannerSettings({
                                  emaAlignmentScanner: {
                                    ...settings.scanner.emaAlignmentScanner,
                                    enabled: e.target.checked,
                                  },
                                })
                              }
                              className="w-4 h-4 accent-primary cursor-pointer"
                            />
                          </label>
                        </div>

                        {settings.scanner.emaAlignmentScanner.enabled && (
                          <>
                            <div className="p-3 bg-bg-secondary border border-frame rounded">
                              <div className="text-primary-muted text-xs font-mono mb-2">
                                Uses chart EMA settings (EMA1: {settings.indicators.ema.ema1.period}, EMA2: {settings.indicators.ema.ema2.period}, EMA3: {settings.indicators.ema.ema3.period})
                              </div>
                              <div className="text-primary-muted text-xs font-mono">
                                Detects when all EMAs align in the same direction
                              </div>
                            </div>

                            <div className="p-3 bg-bg-secondary border border-frame rounded space-y-3">
                              <div className="text-primary font-mono text-xs font-bold mb-2">TIMEFRAMES TO SCAN</div>
                              <div className="grid grid-cols-2 gap-2">
                                {(['1m', '5m', '15m', '1h'] as const).map((tf) => (
                                  <label key={tf} className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={settings.scanner.emaAlignmentScanner.timeframes.includes(tf)}
                                      onChange={(e) => {
                                        const newTimeframes = e.target.checked
                                          ? [...settings.scanner.emaAlignmentScanner.timeframes, tf]
                                          : settings.scanner.emaAlignmentScanner.timeframes.filter((t) => t !== tf);
                                        updateScannerSettings({
                                          emaAlignmentScanner: {
                                            ...settings.scanner.emaAlignmentScanner,
                                            timeframes: newTimeframes,
                                          },
                                        });
                                      }}
                                      className="w-4 h-4 accent-primary cursor-pointer"
                                    />
                                    <span className="text-primary-muted font-mono text-xs">{tf.toUpperCase()}</span>
                                  </label>
                                ))}
                              </div>
                            </div>

                            <div className="p-3 bg-bg-secondary border border-frame rounded">
                              <div className="text-primary font-mono text-xs font-bold mb-3">LOOKBACK PERIOD</div>
                              <div>
                                <label className="text-primary-muted font-mono block mb-1 text-xs">BARS TO CHECK</label>
                                <input
                                  type="number"
                                  min="1"
                                  max="10"
                                  value={settings.scanner.emaAlignmentScanner.lookbackBars}
                                  onChange={(e) =>
                                    updateScannerSettings({
                                      emaAlignmentScanner: {
                                        ...settings.scanner.emaAlignmentScanner,
                                        lookbackBars: Number(e.target.value),
                                      },
                                    })
                                  }
                                  className="w-full bg-bg-primary border border-frame text-primary px-2 py-1 rounded font-mono text-xs"
                                />
                                <div className="text-primary-muted text-xs font-mono mt-1">
                                  How many bars back to check for recent alignment
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'indicators' && (
            <div className="space-y-3">
              {/* Stochastic Settings - Expandable */}
              <div className="border border-frame rounded overflow-hidden">
                <button
                  onClick={() => setIsStochasticExpanded(!isStochasticExpanded)}
                  className="w-full p-3 bg-bg-secondary flex items-center justify-between hover:bg-primary/5 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-primary font-mono text-xs font-bold">█ MULTI-TIMEFRAME STOCHASTIC</span>
                  </div>
                  <span className="text-primary text-sm">{isStochasticExpanded ? '▼' : '▶'}</span>
                </button>

                {isStochasticExpanded && (
                  <div className="p-4 space-y-4 bg-bg-primary">
                    {/* Global Toggle */}
                    <div className="p-3 bg-bg-secondary border border-frame rounded">
                      <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-primary-muted text-xs font-mono">SHOW MULTI-TIMEFRAME STOCHASTICS</span>
                        <input
                          type="checkbox"
                          checked={settings.indicators.stochastic.showMultiTimeframe}
                          onChange={(e) => updateStochasticSettings({ showMultiTimeframe: e.target.checked })}
                          className="w-4 h-4 accent-primary cursor-pointer"
                        />
                      </label>
                    </div>

                    {/* Timeframe Configuration */}
                    <div className="space-y-2">
                      <div className="text-primary text-xs font-mono mb-2">█ TIMEFRAME CONFIGURATION</div>

                      {(Object.keys(settings.indicators.stochastic.timeframes) as Array<keyof typeof settings.indicators.stochastic.timeframes>).map((timeframe) => {
                        const config = settings.indicators.stochastic.timeframes[timeframe];
                        return (
                          <div key={timeframe} className="p-3 bg-bg-secondary border border-frame rounded">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-primary font-mono text-xs font-bold">{timeframe.toUpperCase()}</span>
                              <label className="flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={config.enabled}
                                  onChange={(e) => {
                                    updateStochasticSettings({
                                      timeframes: {
                                        ...settings.indicators.stochastic.timeframes,
                                        [timeframe]: { ...config, enabled: e.target.checked },
                                      },
                                    });
                                  }}
                                  className="w-4 h-4 accent-primary cursor-pointer"
                                />
                              </label>
                            </div>

                            {config.enabled && (
                              <div className="grid grid-cols-3 gap-3 text-xs">
                                <div>
                                  <label className="text-primary-muted font-mono block mb-1">PERIOD</label>
                                  <input
                                    type="number"
                                    min="5"
                                    max="21"
                                    value={config.period}
                                    onChange={(e) => {
                                      updateStochasticSettings({
                                        timeframes: {
                                          ...settings.indicators.stochastic.timeframes,
                                          [timeframe]: { ...config, period: Number(e.target.value) },
                                        },
                                      });
                                    }}
                                    className="w-full bg-bg-primary border border-frame text-primary px-2 py-1 rounded font-mono text-xs"
                                  />
                                </div>
                                <div>
                                  <label className="text-primary-muted font-mono block mb-1">SMOOTH K</label>
                                  <input
                                    type="number"
                                    min="1"
                                    max="5"
                                    value={config.smoothK}
                                    onChange={(e) => {
                                      updateStochasticSettings({
                                        timeframes: {
                                          ...settings.indicators.stochastic.timeframes,
                                          [timeframe]: { ...config, smoothK: Number(e.target.value) },
                                        },
                                      });
                                    }}
                                    className="w-full bg-bg-primary border border-frame text-primary px-2 py-1 rounded font-mono text-xs"
                                  />
                                </div>
                                <div>
                                  <label className="text-primary-muted font-mono block mb-1">SMOOTH D</label>
                                  <input
                                    type="number"
                                    min="1"
                                    max="5"
                                    value={config.smoothD}
                                    onChange={(e) => {
                                      updateStochasticSettings({
                                        timeframes: {
                                          ...settings.indicators.stochastic.timeframes,
                                          [timeframe]: { ...config, smoothD: Number(e.target.value) },
                                        },
                                      });
                                    }}
                                    className="w-full bg-bg-primary border border-frame text-primary px-2 py-1 rounded font-mono text-xs"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* EMA Settings - Expandable */}
              <div className="border border-frame rounded overflow-hidden">
                <button
                  onClick={() => setIsEmaExpanded(!isEmaExpanded)}
                  className="w-full p-3 bg-bg-secondary flex items-center justify-between hover:bg-primary/5 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-primary font-mono text-xs font-bold">█ EXPONENTIAL MOVING AVERAGES</span>
                  </div>
                  <span className="text-primary text-sm">{isEmaExpanded ? '▼' : '▶'}</span>
                </button>

                {isEmaExpanded && (
                  <div className="p-4 space-y-3 bg-bg-primary">
                    {/* EMA 1 */}
                    <div className="p-3 bg-bg-secondary border border-frame rounded">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-primary font-mono text-xs font-bold">EMA 1</span>
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.indicators.ema.ema1.enabled}
                            onChange={(e) => {
                              updateEmaSettings({
                                ema1: { ...settings.indicators.ema.ema1, enabled: e.target.checked },
                              });
                            }}
                            className="w-4 h-4 accent-primary cursor-pointer"
                          />
                        </label>
                      </div>
                      {settings.indicators.ema.ema1.enabled && (
                        <div>
                          <label className="text-primary-muted font-mono block mb-1 text-xs">PERIOD</label>
                          <input
                            type="number"
                            min="2"
                            max="200"
                            value={settings.indicators.ema.ema1.period}
                            onChange={(e) => {
                              updateEmaSettings({
                                ema1: { ...settings.indicators.ema.ema1, period: Number(e.target.value) },
                              });
                            }}
                            className="w-full bg-bg-primary border border-frame text-primary px-2 py-1 rounded font-mono text-xs"
                          />
                        </div>
                      )}
                    </div>

                    {/* EMA 2 */}
                    <div className="p-3 bg-bg-secondary border border-frame rounded">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-primary font-mono text-xs font-bold">EMA 2</span>
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.indicators.ema.ema2.enabled}
                            onChange={(e) => {
                              updateEmaSettings({
                                ema2: { ...settings.indicators.ema.ema2, enabled: e.target.checked },
                              });
                            }}
                            className="w-4 h-4 accent-primary cursor-pointer"
                          />
                        </label>
                      </div>
                      {settings.indicators.ema.ema2.enabled && (
                        <div>
                          <label className="text-primary-muted font-mono block mb-1 text-xs">PERIOD</label>
                          <input
                            type="number"
                            min="2"
                            max="200"
                            value={settings.indicators.ema.ema2.period}
                            onChange={(e) => {
                              updateEmaSettings({
                                ema2: { ...settings.indicators.ema.ema2, period: Number(e.target.value) },
                              });
                            }}
                            className="w-full bg-bg-primary border border-frame text-primary px-2 py-1 rounded font-mono text-xs"
                          />
                        </div>
                      )}
                    </div>

                    {/* EMA 3 */}
                    <div className="p-3 bg-bg-secondary border border-frame rounded">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-primary font-mono text-xs font-bold">EMA 3</span>
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.indicators.ema.ema3.enabled}
                            onChange={(e) => {
                              updateEmaSettings({
                                ema3: { ...settings.indicators.ema.ema3, enabled: e.target.checked },
                              });
                            }}
                            className="w-4 h-4 accent-primary cursor-pointer"
                          />
                        </label>
                      </div>
                      {settings.indicators.ema.ema3.enabled && (
                        <div>
                          <label className="text-primary-muted font-mono block mb-1 text-xs">PERIOD</label>
                          <input
                            type="number"
                            min="2"
                            max="200"
                            value={settings.indicators.ema.ema3.period}
                            onChange={(e) => {
                              updateEmaSettings({
                                ema3: { ...settings.indicators.ema.ema3, period: Number(e.target.value) },
                              });
                            }}
                            className="w-full bg-bg-primary border border-frame text-primary px-2 py-1 rounded font-mono text-xs"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* MACD Settings - Expandable */}
              <div className="border border-frame rounded overflow-hidden">
                <button
                  onClick={() => setIsMacdExpanded(!isMacdExpanded)}
                  className="w-full p-3 bg-bg-secondary flex items-center justify-between hover:bg-primary/5 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-primary font-mono text-xs font-bold">█ MACD</span>
                  </div>
                  <span className="text-primary text-sm">{isMacdExpanded ? '▼' : '▶'}</span>
                </button>

                {isMacdExpanded && (
                  <div className="p-4 space-y-3 bg-bg-primary">
                    {/* Enable/Disable */}
                    <div className="p-3 bg-bg-secondary border border-frame rounded">
                      <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-primary-muted text-xs font-mono">ENABLE MACD</span>
                        <input
                          type="checkbox"
                          checked={settings.indicators.macd.enabled}
                          onChange={(e) => updateMacdSettings({ enabled: e.target.checked })}
                          className="w-4 h-4 accent-primary cursor-pointer"
                        />
                      </label>
                    </div>

                    {settings.indicators.macd.enabled && (
                      <div className="p-3 bg-bg-secondary border border-frame rounded">
                        <div className="text-primary font-mono text-xs font-bold mb-3">PARAMETERS</div>
                        <div className="grid grid-cols-3 gap-3 text-xs">
                          <div>
                            <label className="text-primary-muted font-mono block mb-1">FAST PERIOD</label>
                            <input
                              type="number"
                              min="2"
                              max="50"
                              value={settings.indicators.macd.fastPeriod}
                              onChange={(e) => updateMacdSettings({ fastPeriod: Number(e.target.value) })}
                              className="w-full bg-bg-primary border border-frame text-primary px-2 py-1 rounded font-mono text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-primary-muted font-mono block mb-1">SLOW PERIOD</label>
                            <input
                              type="number"
                              min="2"
                              max="100"
                              value={settings.indicators.macd.slowPeriod}
                              onChange={(e) => updateMacdSettings({ slowPeriod: Number(e.target.value) })}
                              className="w-full bg-bg-primary border border-frame text-primary px-2 py-1 rounded font-mono text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-primary-muted font-mono block mb-1">SIGNAL PERIOD</label>
                            <input
                              type="number"
                              min="2"
                              max="50"
                              value={settings.indicators.macd.signalPeriod}
                              onChange={(e) => updateMacdSettings({ signalPeriod: Number(e.target.value) })}
                              className="w-full bg-bg-primary border border-frame text-primary px-2 py-1 rounded font-mono text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'orders' && (
            <div className="space-y-3">
              <div className="p-3 bg-bg-secondary border border-frame rounded">
                <div className="text-primary font-mono text-xs font-bold mb-3">█ POSITION SIZE (% OF ACCOUNT VALUE)</div>
                <p className="text-primary-muted text-[10px] mb-4 leading-relaxed">
                  Configure the percentage of your account value to use for each order type.
                  These percentages will be applied when executing trades.
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="text-primary-muted font-mono block mb-2 text-xs flex items-center justify-between">
                      <span>CLOUD ORDERS</span>
                      <span className="text-accent-blue">{settings.orders.cloudPercentage}%</span>
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="50"
                      step="1"
                      value={settings.orders.cloudPercentage}
                      onChange={(e) => updateOrderSettings({ cloudPercentage: Number(e.target.value) })}
                      className="w-full h-2 bg-bg-primary rounded-lg appearance-none cursor-pointer accent-accent-blue"
                    />
                    <div className="flex justify-between text-[10px] text-primary-muted mt-1">
                      <span>1%</span>
                      <span>50%</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-primary-muted font-mono block mb-2 text-xs flex items-center justify-between">
                      <span>SMALL ORDERS (SM LONG/SHORT)</span>
                      <span className="text-primary">{settings.orders.smallPercentage}%</span>
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="50"
                      step="1"
                      value={settings.orders.smallPercentage}
                      onChange={(e) => updateOrderSettings({ smallPercentage: Number(e.target.value) })}
                      className="w-full h-2 bg-bg-primary rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <div className="flex justify-between text-[10px] text-primary-muted mt-1">
                      <span>1%</span>
                      <span>50%</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-primary-muted font-mono block mb-2 text-xs flex items-center justify-between">
                      <span>BIG ORDERS (BIG LONG/SHORT)</span>
                      <span className="text-accent-rose">{settings.orders.bigPercentage}%</span>
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      step="1"
                      value={settings.orders.bigPercentage}
                      onChange={(e) => updateOrderSettings({ bigPercentage: Number(e.target.value) })}
                      className="w-full h-2 bg-bg-primary rounded-lg appearance-none cursor-pointer accent-accent-rose"
                    />
                    <div className="flex justify-between text-[10px] text-primary-muted mt-1">
                      <span>1%</span>
                      <span>100%</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-bg-secondary border border-frame rounded">
                <div className="text-primary-muted text-[10px] leading-relaxed">
                  <span className="text-bullish font-bold">NOTE:</span> These percentages represent how much of your total account value will be used for each order type.
                  Make sure the total of all active positions doesn't exceed your risk tolerance.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
