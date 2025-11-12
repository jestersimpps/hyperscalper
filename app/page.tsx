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
            <div className="absolute inset-0 bg-gradient-to-br from-slate-950/80 via-slate-900/90 to-slate-950/80 z-10"></div>
            <div className="w-full h-full flex items-center justify-center">
              <img
                src="/landing/hero.png"
                alt="Hyperscalper Platform"
                className="w-full h-auto max-h-screen object-contain"
              />
            </div>
          </div>

          <div
            className="absolute -top-20 -right-20 w-96 h-96 bg-primary/20 rounded-full blur-3xl z-0"
            style={{
              transform: `translateY(${scrollY * 0.3}px)`,
            }}
          ></div>
          <div
            className="absolute -bottom-20 -left-20 w-96 h-96 bg-primary/10 rounded-full blur-3xl z-0"
            style={{
              transform: `translateY(${scrollY * 0.7}px)`,
            }}
          ></div>

          <div className="relative z-20 max-w-5xl mx-auto px-6 text-center">
            <div className="flex items-center justify-center gap-4 mb-6">
              <h1 className="text-5xl md:text-8xl font-bold tracking-tight bg-gradient-to-r from-white via-primary to-white bg-clip-text text-transparent animate-gradient bg-[length:200%_auto]">
                HYPERSCALPER
              </h1>
              <span className="px-3 py-1 bg-yellow-500/20 border border-yellow-500/50 rounded-lg text-yellow-500 font-mono text-xs md:text-sm font-bold">
                BETA
              </span>
            </div>
            <p className="text-xl md:text-3xl text-white mb-3 font-mono font-light">
              Advanced Trading Terminal for <span className="text-primary font-bold">Hyperliquid</span>
            </p>
            <p className="text-lg md:text-2xl text-primary/80 mb-6 font-mono font-light">
              Scalp smarter. Trade faster. Win more.
            </p>
            <p className="text-base md:text-xl text-gray-300 mb-10 max-w-3xl mx-auto leading-relaxed">
              No backend. No middleman. Direct connection to Hyperliquid DEX. Your keys never leave your browser.
            </p>
            <div className="flex gap-4 justify-center">
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
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-6">
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-8 max-w-2xl w-full relative shadow-2xl">
              <button
                onClick={() => setShowCredentials(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-primary font-mono text-xl transition-colors"
              >
                ✕
              </button>
              <div className="mb-6">
                <h2 className="text-2xl font-bold font-mono text-primary mb-2">LET'S GO</h2>
                <p className="text-gray-400 text-sm">Connect your Hyperliquid wallet</p>
              </div>
              <CredentialsSettings />
            </div>
          </div>
        )}

        <div className="max-w-6xl mx-auto px-6 py-20">
          <section className="mb-32">
            <div className="backdrop-blur-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/30 rounded-2xl p-8 md:p-12 shadow-xl">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 font-mono text-primary">100% CLIENT-SIDE</h2>
              <p className="text-gray-200 text-lg leading-relaxed">
                Zero backend servers. Zero data collection. Every API call goes straight from your browser to Hyperliquid.
                Your private keys are encrypted locally and never transmitted anywhere. You own your data. You control your trades.
              </p>
            </div>
          </section>

          <section className="mb-32">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all hover:scale-105">
                <h3 className="text-xl font-mono text-primary mb-3">ANALYSIS</h3>
                <p className="text-gray-300 leading-relaxed">
                  Real indicators. Real signals. No BS. EMA, MACD, Stochastic with divergence detection and auto-signals.
                </p>
              </div>

              <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all hover:scale-105">
                <h3 className="text-xl font-mono text-primary mb-3">EXECUTION</h3>
                <p className="text-gray-300 leading-relaxed">
                  Hit your entries with cloud ladders. Scale in/out like a pro. Auto TPSL so you can actually sleep.
                </p>
              </div>

              <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all hover:scale-105">
                <h3 className="text-xl font-mono text-primary mb-3">SCANNER</h3>
                <p className="text-gray-300 leading-relaxed">
                  Find setups before everyone else. Multi-symbol scanning with divergence alerts and signal strength scoring.
                </p>
              </div>

              <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all hover:scale-105">
                <h3 className="text-xl font-mono text-primary mb-3">TRACKING</h3>
                <p className="text-gray-300 leading-relaxed">
                  Know your stats. Track P&L, win rate, profit factor. See what works, cut what doesn't.
                </p>
              </div>
            </div>
          </section>

        </div>

        <section className="mb-32 w-full">
          <div className="max-w-6xl mx-auto px-6 mb-12">
            <h2 className="text-4xl md:text-5xl font-bold font-mono text-center bg-gradient-to-r from-white to-primary bg-clip-text text-transparent">
              FEATURES THAT MATTER
            </h2>
          </div>

          <div className="relative overflow-hidden w-full">
            <div className="flex gap-6 animate-scroll-left">
              {/* First set of features */}
              <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-primary/30 transition-all overflow-hidden flex-none w-80">

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

              <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-primary/30 transition-all overflow-hidden flex-none w-80">
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

              <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-primary/30 transition-all overflow-hidden flex-none w-80">
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

              <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-primary/30 transition-all overflow-hidden flex-none w-80">
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

              <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-primary/30 transition-all overflow-hidden flex-none w-80">
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

              <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-primary/30 transition-all overflow-hidden flex-none w-80">
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

              <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-primary/30 transition-all overflow-hidden flex-none w-80">
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

              {/* Duplicate set for seamless loop */}
              <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-primary/30 transition-all overflow-hidden flex-none w-80">
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

              <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-primary/30 transition-all overflow-hidden flex-none w-80">
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

              <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-primary/30 transition-all overflow-hidden flex-none w-80">
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

              <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-primary/30 transition-all overflow-hidden flex-none w-80">
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

              <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-primary/30 transition-all overflow-hidden flex-none w-80">
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

              <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-primary/30 transition-all overflow-hidden flex-none w-80">
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

              <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-primary/30 transition-all overflow-hidden flex-none w-80">
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

        <div className="max-w-6xl mx-auto px-6">
          <section className="mb-32">
            <h2 className="text-4xl md:text-5xl font-bold mb-12 font-mono text-center bg-gradient-to-r from-white to-primary bg-clip-text text-transparent">
              BUILT FOR SCALPERS
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all">
                <span className="text-primary font-mono text-lg">TIMEFRAMES</span>
                <p className="text-gray-300 mt-2">1m, 5m, 15m, 1h. Fast TFs only. Multi-chart view with sync zoom.</p>
              </div>
              <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all">
                <span className="text-primary font-mono text-lg">INDICATORS</span>
                <p className="text-gray-300 mt-2">EMA, MACD, Stochastic. Fully customizable. No bloat.</p>
              </div>
              <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all">
                <span className="text-primary font-mono text-lg">PATTERNS</span>
                <p className="text-gray-300 mt-2">Auto divergence detection. Pivots. Support/resistance. Your edge automated.</p>
              </div>
              <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all">
                <span className="text-primary font-mono text-lg">ORDERS</span>
                <p className="text-gray-300 mt-2">Cloud ladders for DCA. Instant market fills. Smart position scaling.</p>
              </div>
            </div>
          </section>

          <section className="mb-32">
            <h2 className="text-4xl md:text-5xl font-bold mb-12 font-mono text-center bg-gradient-to-r from-white to-primary bg-clip-text text-transparent">
              HOW IT WORKS
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl p-8 hover:bg-white/10 transition-all group">
                <div className="flex items-start gap-4">
                  <div className="text-4xl font-bold font-mono text-primary/30 group-hover:text-primary transition-colors">01</div>
                  <div className="flex-1">
                    <p className="text-primary font-mono text-lg mb-2">CONNECT</p>
                    <p className="text-gray-300">Plug in your Hyperliquid key. Encrypted locally. Zero backend. All API calls go straight to Hyperliquid.</p>
                  </div>
                </div>
              </div>
              <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl p-8 hover:bg-white/10 transition-all group">
                <div className="flex items-start gap-4">
                  <div className="text-4xl font-bold font-mono text-primary/30 group-hover:text-primary transition-colors">02</div>
                  <div className="flex-1">
                    <p className="text-primary font-mono text-lg mb-2">SCAN</p>
                    <p className="text-gray-300">Scanner shows you the setups. Divergences, signals, everything you need to find your edge.</p>
                  </div>
                </div>
              </div>
              <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl p-8 hover:bg-white/10 transition-all group">
                <div className="flex items-start gap-4">
                  <div className="text-4xl font-bold font-mono text-primary/30 group-hover:text-primary transition-colors">03</div>
                  <div className="flex-1">
                    <p className="text-primary font-mono text-lg mb-2">SEND IT</p>
                    <p className="text-gray-300">Cloud ladders for entries. TPSL set automatically. Position management on point.</p>
                  </div>
                </div>
              </div>
              <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl p-8 hover:bg-white/10 transition-all group">
                <div className="flex items-start gap-4">
                  <div className="text-4xl font-bold font-mono text-primary/30 group-hover:text-primary transition-colors">04</div>
                  <div className="flex-1">
                    <p className="text-primary font-mono text-lg mb-2">REVIEW</p>
                    <p className="text-gray-300">Track every trade. See your win rate. Know your numbers. Improve daily.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <footer className="text-center pb-32">
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-12 inline-block">
              <h3 className="text-3xl font-bold mb-4 font-mono">READY TO TRADE?</h3>
              <p className="text-gray-300 mb-8 max-w-md">Start scalping smarter with zero setup. Just connect your wallet and go.</p>
              <div className="flex gap-4 justify-center">
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
          </footer>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 backdrop-blur-xl bg-yellow-900/30 border-t-2 border-yellow-500/50">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-center gap-3 text-center">
            <svg className="w-5 h-5 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="text-xs md:text-sm text-yellow-200">
              <strong className="font-bold text-yellow-500">BETA SOFTWARE:</strong> This platform is in beta. Trading carries substantial risk. Use at your own risk. Never trade more than you can afford to lose.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
