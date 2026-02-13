'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCredentials } from '@/lib/context/credentials-context';
import { CredentialsSettings } from '@/components/settings/CredentialsSettings';

export default function LandingPage() {
  const router = useRouter();
  const { credentials, isLoaded } = useCredentials();
  const [showCredentials, setShowCredentials] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [visibleSections, setVisibleSections] = useState<Set<number>>(new Set());

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = parseInt(entry.target.getAttribute('data-section-index') || '0');
            setVisibleSections((prev) => new Set([...prev, index]));
          }
        });
      },
      { threshold: 0.1 }
    );

    const sections = document.querySelectorAll('[data-section-index]');
    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (isLoaded && credentials?.walletAddress) {
      router.replace(`/${credentials.walletAddress}/trades`);
    }
  }, [router, credentials?.walletAddress, isLoaded]);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg-primary">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-primary-muted">Loading...</p>
        </div>
      </div>
    );
  }

  if (credentials?.walletAddress) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent pointer-events-none"></div>

      <div className="relative">
        <header className="min-h-screen relative overflow-hidden flex items-center justify-center">
          <div
            className="absolute inset-0 z-0"
            style={{
              transform: `translateY(${scrollY * 0.5}px)`,
              transition: 'transform 0.1s ease-out'
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-slate-950/70 via-slate-900/80 to-slate-950/70 z-10"></div>
            <img
              src="/landing/hero.png"
              alt="Hyperscalper Platform"
              className="w-full h-full object-cover"
            />
          </div>

          <div
            className="absolute -top-20 -right-20 w-64 h-64 md:w-96 md:h-96 bg-primary/20 rounded-full blur-3xl z-0"
            style={{
              transform: `translateY(${scrollY * 0.3}px)`,
            }}
          ></div>
          <div
            className="absolute -bottom-20 -left-20 w-64 h-64 md:w-96 md:h-96 bg-primary/10 rounded-full blur-3xl z-0"
            style={{
              transform: `translateY(${scrollY * 0.7}px)`,
            }}
          ></div>

          <div className="relative z-20 max-w-5xl mx-auto px-4 md:px-6 text-center">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 md:gap-4 mb-6">
              <h1 className="text-4xl sm:text-5xl md:text-8xl font-bold tracking-tight bg-gradient-to-r from-white via-primary to-white bg-clip-text text-transparent animate-gradient bg-[length:200%_auto]">
                HYPERSCALPER
              </h1>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-yellow-500/20 border border-yellow-500/50 rounded-lg text-yellow-500 font-mono text-xs md:text-sm font-bold">
                  BETA
                </span>
                <a
                  href="https://github.com/jestersimpps/hyperscalper"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-primary/50 rounded-lg transition-all hover:scale-110"
                  title="View on GitHub"
                >
                  <svg className="w-5 h-5 md:w-6 md:h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                </a>
              </div>
            </div>
            <p className="text-lg sm:text-xl md:text-3xl text-white mb-3 font-mono font-light">
              Advanced Trading Terminal for <span className="text-primary font-bold">Hyperliquid</span>
            </p>
            <p className="text-base sm:text-lg md:text-2xl text-primary/80 mb-6 font-mono font-light">
              Scalp smarter. Trade faster. Win more.
            </p>
            <p className="text-sm sm:text-base md:text-xl text-gray-300 mb-10 max-w-3xl mx-auto leading-relaxed px-4">
              No backend. No middleman. Direct connection to Hyperliquid DEX. Your keys never leave your browser.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center px-4">
              <a
                href="/0xb83de012dba672c76a7dbbbf3e459cb59d7d6e36/btc/"
                className="group relative px-8 py-4 bg-gradient-to-r from-gray-700 to-gray-600 hover:from-gray-600 hover:to-gray-500 font-mono uppercase tracking-wider transition-all text-sm rounded-xl shadow-lg hover:shadow-xl hover:scale-105"
              >
                <span className="relative z-10">View Demo</span>
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </a>
              <button
                onClick={() => setShowCredentials(true)}
                className="group relative px-8 py-4 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary font-mono uppercase tracking-wider transition-all text-sm rounded-xl shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-105"
              >
                <span className="relative z-10">Launch Terminal</span>
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </button>
            </div>
          </div>
        </header>

        {showCredentials && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 md:p-6">
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4 md:p-8 max-w-2xl w-full relative shadow-2xl max-h-[90vh] overflow-y-auto">
              <button
                onClick={() => setShowCredentials(false)}
                className="absolute top-3 right-3 md:top-4 md:right-4 text-gray-400 hover:text-primary font-mono text-xl transition-colors"
              >
                ✕
              </button>
              <div className="mb-6">
                <h2 className="text-xl md:text-2xl font-bold font-mono text-primary mb-2">LET'S GO</h2>
                <p className="text-gray-400 text-xs md:text-sm">Connect your Hyperliquid wallet</p>
              </div>
              <CredentialsSettings />
            </div>
          </div>
        )}

        <div className="max-w-6xl mx-auto px-4 md:px-6 py-12 md:py-20">
          <section className="mb-16 md:mb-32">
            <div className="backdrop-blur-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/30 rounded-2xl p-6 md:p-8 lg:p-12 shadow-xl">
              <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-3 md:mb-4 font-mono text-primary">100% CLIENT-SIDE</h2>
              <p className="text-gray-200 text-base md:text-lg leading-relaxed">
                Zero backend servers. Zero data collection. Every API call goes straight from your browser to Hyperliquid.
                Your private keys are encrypted locally and never transmitted anywhere. You own your data. You control your trades.
              </p>
            </div>
          </section>

          <section className="mb-16 md:mb-32">
            <div className="grid md:grid-cols-2 gap-4 md:gap-6">
              <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl p-5 md:p-6 hover:bg-white/10 transition-all md:hover:scale-105">
                <h3 className="text-lg md:text-xl font-mono text-primary mb-2 md:mb-3">ANALYSIS</h3>
                <p className="text-gray-300 text-sm md:text-base leading-relaxed">
                  Real indicators. Real signals. No BS. EMA, MACD, Stochastic with divergence detection and auto-signals.
                </p>
              </div>

              <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl p-5 md:p-6 hover:bg-white/10 transition-all md:hover:scale-105">
                <h3 className="text-lg md:text-xl font-mono text-primary mb-2 md:mb-3">EXECUTION</h3>
                <p className="text-gray-300 text-sm md:text-base leading-relaxed">
                  Hit your entries with cloud ladders. Scale in/out like a pro. Auto TPSL so you can actually sleep.
                </p>
              </div>

              <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl p-5 md:p-6 hover:bg-white/10 transition-all md:hover:scale-105">
                <h3 className="text-lg md:text-xl font-mono text-primary mb-2 md:mb-3">SCANNER</h3>
                <p className="text-gray-300 text-sm md:text-base leading-relaxed">
                  Find setups before everyone else. Multi-symbol scanning with divergence alerts and signal strength scoring.
                </p>
              </div>

              <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl p-5 md:p-6 hover:bg-white/10 transition-all md:hover:scale-105">
                <h3 className="text-lg md:text-xl font-mono text-primary mb-2 md:mb-3">TRACKING</h3>
                <p className="text-gray-300 text-sm md:text-base leading-relaxed">
                  Know your stats. Track P&L, win rate, profit factor. See what works, cut what doesn't.
                </p>
              </div>
            </div>
          </section>

        </div>

        <section className="mb-16 md:mb-32 w-full">
          <div className="max-w-6xl mx-auto px-4 md:px-6 mb-8 md:mb-12">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold font-mono text-center bg-gradient-to-r from-white to-primary bg-clip-text text-transparent">
              FEATURES THAT MATTER
            </h2>
            <p className="text-center text-gray-400 text-sm mt-2 md:hidden">Swipe to explore →</p>
          </div>

          <div className="relative overflow-x-auto overflow-y-hidden w-full px-4 md:px-0 md:overflow-hidden scrollbar-hide snap-x snap-mandatory">
            <div className="flex gap-4 md:gap-6 md:animate-scroll-left pb-4">
              {/* First set of features */}
              <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-primary/30 transition-all overflow-hidden flex-none w-[85vw] md:w-80 snap-start">

                <div className="group aspect-video overflow-hidden bg-black/20">
                  <img
                    src="/landing/symboloverview.png"
                    alt="Symbol overview with minicharts"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                </div>
                <div className="p-5 md:p-6">
                  <h3 className="text-base md:text-lg font-mono text-primary mb-2">SYMBOL OVERVIEW</h3>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    See every symbol at a glance with minicharts. Spot opportunities across the entire market in seconds.
                  </p>
                </div>
              </div>

              <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-primary/30 transition-all overflow-hidden flex-none w-[85vw] md:w-80 snap-start">
                <div className="group aspect-video overflow-hidden bg-black/20">
                  <img
                    src="/landing/preciseordering.gif"
                    alt="Precise cursor-based order placement"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                </div>
                <div className="p-5 md:p-6">
                  <h3 className="text-base md:text-lg font-mono text-primary mb-2">PRECISE ORDERING</h3>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    Click exactly where you want to enter. Place limit orders directly on the chart at your desired price.
                  </p>
                </div>
              </div>

              <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-primary/30 transition-all overflow-hidden flex-none w-[85vw] md:w-80 snap-start">
                <div className="group aspect-video overflow-hidden bg-black/20">
                  <img
                    src="/landing/keyboardshortcuts.png"
                    alt="Keyboard shortcuts"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                </div>
                <div className="p-5 md:p-6">
                  <h3 className="text-base md:text-lg font-mono text-primary mb-2">KEYBOARD SHORTCUTS</h3>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    Trade at machine speed with hotkeys. Buy, sell, close positions - all from your keyboard.
                  </p>
                </div>
              </div>

              <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-primary/30 transition-all overflow-hidden flex-none w-[85vw] md:w-80 snap-start">
                <div className="group aspect-video overflow-hidden bg-black/20">
                  <img
                    src="/landing/scanner.png"
                    alt="Market scanner for signals"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                </div>
                <div className="p-5 md:p-6">
                  <h3 className="text-base md:text-lg font-mono text-primary mb-2">MARKET SCANNER</h3>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    Auto-scan the entire market for setups. Find the highest-probability trades ranked by quality.
                  </p>
                </div>
              </div>

              <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-primary/30 transition-all overflow-hidden flex-none w-[85vw] md:w-80 snap-start">
                <div className="group aspect-video overflow-hidden bg-black/20">
                  <img
                    src="/landing/multitimeframe.png"
                    alt="Multi-timeframe analysis"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                </div>
                <div className="p-5 md:p-6">
                  <h3 className="text-base md:text-lg font-mono text-primary mb-2">MULTI-TIMEFRAME</h3>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    Switch between 1m, 5m, 15m, 1h instantly. See the full picture while executing on lower TFs.
                  </p>
                </div>
              </div>

              <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-primary/30 transition-all overflow-hidden flex-none w-[85vw] md:w-80 snap-start">
                <div className="group aspect-video overflow-hidden bg-black/20">
                  <img
                    src="/landing/dailyoverview.png"
                    alt="Performance tracking"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                </div>
                <div className="p-5 md:p-6">
                  <h3 className="text-base md:text-lg font-mono text-primary mb-2">PERFORMANCE TRACKING</h3>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    Daily and monthly overviews. Track P&L, win rate, profit factor - all the numbers that matter.
                  </p>
                </div>
              </div>

              <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-primary/30 transition-all overflow-hidden flex-none w-[85vw] md:w-80 snap-start">
                <div className="group aspect-video overflow-hidden bg-black/20">
                  <img
                    src="/landing/multimonitor.png"
                    alt="Multi-monitor layouts"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                </div>
                <div className="p-5 md:p-6">
                  <h3 className="text-base md:text-lg font-mono text-primary mb-2">MULTI-MONITOR</h3>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    Pop out charts to separate windows. Build your perfect multi-screen trading setup.
                  </p>
                </div>
              </div>

              {/* Duplicate set for seamless loop on desktop */}
              <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-primary/30 transition-all overflow-hidden flex-none w-80 snap-start hidden md:block">
                <div className="group aspect-video overflow-hidden bg-black/20">
                  <img
                    src="/landing/symboloverview.png"
                    alt="Symbol overview with minicharts"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                </div>
                <div className="p-6">
                  <h3 className="text-lg font-mono text-primary mb-2">SYMBOL OVERVIEW</h3>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    See every symbol at a glance with minicharts. Spot opportunities across the entire market in seconds.
                  </p>
                </div>
              </div>

              <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-primary/30 transition-all overflow-hidden flex-none w-80 snap-start hidden md:block">
                <div className="group aspect-video overflow-hidden bg-black/20">
                  <img
                    src="/landing/preciseordering.gif"
                    alt="Precise cursor-based order placement"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                </div>
                <div className="p-6">
                  <h3 className="text-lg font-mono text-primary mb-2">PRECISE ORDERING</h3>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    Click exactly where you want to enter. Place limit orders directly on the chart at your desired price.
                  </p>
                </div>
              </div>

              <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-primary/30 transition-all overflow-hidden flex-none w-80 snap-start hidden md:block">
                <div className="group aspect-video overflow-hidden bg-black/20">
                  <img
                    src="/landing/keyboardshortcuts.png"
                    alt="Keyboard shortcuts"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                </div>
                <div className="p-6">
                  <h3 className="text-lg font-mono text-primary mb-2">KEYBOARD SHORTCUTS</h3>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    Trade at machine speed with hotkeys. Buy, sell, close positions - all from your keyboard.
                  </p>
                </div>
              </div>

              <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-primary/30 transition-all overflow-hidden flex-none w-80 snap-start hidden md:block">
                <div className="group aspect-video overflow-hidden bg-black/20">
                  <img
                    src="/landing/scanner.png"
                    alt="Market scanner for signals"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                </div>
                <div className="p-6">
                  <h3 className="text-lg font-mono text-primary mb-2">MARKET SCANNER</h3>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    Auto-scan the entire market for setups. Find the highest-probability trades ranked by quality.
                  </p>
                </div>
              </div>

              <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-primary/30 transition-all overflow-hidden flex-none w-80 snap-start hidden md:block">
                <div className="group aspect-video overflow-hidden bg-black/20">
                  <img
                    src="/landing/multitimeframe.png"
                    alt="Multi-timeframe analysis"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                </div>
                <div className="p-6">
                  <h3 className="text-lg font-mono text-primary mb-2">MULTI-TIMEFRAME</h3>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    Switch between 1m, 5m, 15m, 1h instantly. See the full picture while executing on lower TFs.
                  </p>
                </div>
              </div>

              <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-primary/30 transition-all overflow-hidden flex-none w-80 snap-start hidden md:block">
                <div className="group aspect-video overflow-hidden bg-black/20">
                  <img
                    src="/landing/dailyoverview.png"
                    alt="Performance tracking"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                </div>
                <div className="p-6">
                  <h3 className="text-lg font-mono text-primary mb-2">PERFORMANCE TRACKING</h3>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    Daily and monthly overviews. Track P&L, win rate, profit factor - all the numbers that matter.
                  </p>
                </div>
              </div>

              <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-primary/30 transition-all overflow-hidden flex-none w-80 snap-start hidden md:block">
                <div className="group aspect-video overflow-hidden bg-black/20">
                  <img
                    src="/landing/multimonitor.png"
                    alt="Multi-monitor layouts"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                </div>
                <div className="p-6">
                  <h3 className="text-lg font-mono text-primary mb-2">MULTI-MONITOR</h3>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    Pop out charts to separate windows. Build your perfect multi-screen trading setup.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <section className="mb-16 md:mb-32">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-8 md:mb-12 font-mono text-center bg-gradient-to-r from-white to-primary bg-clip-text text-transparent">
              BUILT FOR SCALPERS
            </h2>
            <div className="grid md:grid-cols-2 gap-4 md:gap-6">
              <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl p-5 md:p-6 hover:bg-white/10 transition-all">
                <span className="text-primary font-mono text-base md:text-lg">TIMEFRAMES</span>
                <p className="text-gray-300 text-sm md:text-base mt-2">1m, 5m, 15m, 1h. Fast TFs only. Multi-chart view with sync zoom.</p>
              </div>
              <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl p-5 md:p-6 hover:bg-white/10 transition-all">
                <span className="text-primary font-mono text-base md:text-lg">INDICATORS</span>
                <p className="text-gray-300 text-sm md:text-base mt-2">EMA, MACD, Stochastic. Fully customizable. No bloat.</p>
              </div>
              <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl p-5 md:p-6 hover:bg-white/10 transition-all">
                <span className="text-primary font-mono text-base md:text-lg">PATTERNS</span>
                <p className="text-gray-300 text-sm md:text-base mt-2">Auto divergence detection. Pivots. Support/resistance. Your edge automated.</p>
              </div>
              <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl p-5 md:p-6 hover:bg-white/10 transition-all">
                <span className="text-primary font-mono text-base md:text-lg">ORDERS</span>
                <p className="text-gray-300 text-sm md:text-base mt-2">Cloud ladders for DCA. Instant market fills. Smart position scaling.</p>
              </div>
            </div>
          </section>

          <section className="mb-16 md:mb-32">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-8 md:mb-12 font-mono text-center bg-gradient-to-r from-white to-primary bg-clip-text text-transparent">
              HOW IT WORKS
            </h2>
            <div className="grid md:grid-cols-2 gap-4 md:gap-6">
              <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl p-5 md:p-8 hover:bg-white/10 transition-all group">
                <div className="flex items-start gap-3 md:gap-4">
                  <div className="text-3xl md:text-4xl font-bold font-mono text-primary/30 group-hover:text-primary transition-colors">01</div>
                  <div className="flex-1">
                    <p className="text-primary font-mono text-base md:text-lg mb-2">CONNECT</p>
                    <p className="text-gray-300 text-sm md:text-base">Plug in your Hyperliquid key. Encrypted locally. Zero backend. All API calls go straight to Hyperliquid.</p>
                  </div>
                </div>
              </div>
              <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl p-5 md:p-8 hover:bg-white/10 transition-all group">
                <div className="flex items-start gap-3 md:gap-4">
                  <div className="text-3xl md:text-4xl font-bold font-mono text-primary/30 group-hover:text-primary transition-colors">02</div>
                  <div className="flex-1">
                    <p className="text-primary font-mono text-base md:text-lg mb-2">SCAN</p>
                    <p className="text-gray-300 text-sm md:text-base">Scanner shows you the setups. Divergences, signals, everything you need to find your edge.</p>
                  </div>
                </div>
              </div>
              <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl p-5 md:p-8 hover:bg-white/10 transition-all group">
                <div className="flex items-start gap-3 md:gap-4">
                  <div className="text-3xl md:text-4xl font-bold font-mono text-primary/30 group-hover:text-primary transition-colors">03</div>
                  <div className="flex-1">
                    <p className="text-primary font-mono text-base md:text-lg mb-2">SEND IT</p>
                    <p className="text-gray-300 text-sm md:text-base">Cloud ladders for entries. TPSL set automatically. Position management on point.</p>
                  </div>
                </div>
              </div>
              <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl p-5 md:p-8 hover:bg-white/10 transition-all group">
                <div className="flex items-start gap-3 md:gap-4">
                  <div className="text-3xl md:text-4xl font-bold font-mono text-primary/30 group-hover:text-primary transition-colors">04</div>
                  <div className="flex-1">
                    <p className="text-primary font-mono text-base md:text-lg mb-2">REVIEW</p>
                    <p className="text-gray-300 text-sm md:text-base">Track every trade. See your win rate. Know your numbers. Improve daily.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <footer className="text-center pb-16 md:pb-32">
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 md:p-12 inline-block w-full md:w-auto">
              <h3 className="text-2xl md:text-3xl font-bold mb-3 md:mb-4 font-mono">READY TO TRADE?</h3>
              <p className="text-gray-300 text-sm md:text-base mb-6 md:mb-8 max-w-md mx-auto">Start scalping smarter with zero setup. Just connect your wallet and go.</p>
              <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center">
                <a
                  href="/0xb83de012dba672c76a7dbbbf3e459cb59d7d6e36/btc/"
                  className="group relative px-8 py-4 bg-gradient-to-r from-gray-700 to-gray-600 hover:from-gray-600 hover:to-gray-500 font-mono uppercase tracking-wider transition-all text-sm rounded-xl shadow-lg hover:shadow-xl hover:scale-105"
                >
                  <span className="relative z-10">View Demo</span>
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </a>
                <button
                  onClick={() => setShowCredentials(true)}
                  className="group relative px-8 py-4 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary font-mono uppercase tracking-wider transition-all text-sm rounded-xl shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-105"
                >
                  <span className="relative z-10">Launch Terminal</span>
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </button>
              </div>
              <div className="mt-8 pt-6 border-t border-white/10">
                <a
                  href="https://github.com/jestersimpps/hyperscalper"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-gray-400 hover:text-primary transition-colors font-mono text-xs md:text-sm"
                >
                  <svg className="w-4 h-4 md:w-5 md:h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  <span>Open Source on GitHub</span>
                </a>
                <span className="mx-2 text-white/20">·</span>
                <a
                  href="https://jovweb.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-gray-400 hover:text-primary transition-colors font-mono text-xs md:text-sm"
                >
                  <span>Built by Jo Vinkenroye</span>
                </a>
              </div>
            </div>
          </footer>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 backdrop-blur-xl bg-yellow-900/30 border-t-2 border-yellow-500/50">
        <div className="max-w-7xl mx-auto px-3 md:px-4 py-2 md:py-3">
          <div className="flex items-center justify-center gap-2 md:gap-3 text-center">
            <svg className="w-4 h-4 md:w-5 md:h-5 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="text-[10px] sm:text-xs md:text-sm text-yellow-200">
              <strong className="font-bold text-yellow-500">BETA SOFTWARE:</strong> This platform is in beta. Trading carries substantial risk. Use at your own risk. Never trade more than you can afford to lose.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
