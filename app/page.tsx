'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCredentials } from '@/lib/context/credentials-context';
import { CredentialsSettings } from '@/components/settings/CredentialsSettings';

export default function LandingPage() {
  const router = useRouter();
  const { credentials, isLoaded } = useCredentials();
  const [showCredentials, setShowCredentials] = useState(false);

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
    <div className="min-h-screen bg-bg-primary text-white">
      <div className="max-w-5xl mx-auto px-6 py-16">
        <header className="mb-20">
          <h1 className="text-7xl font-bold mb-4 tracking-tight">
            HYPERSCALPER
          </h1>
          <p className="text-2xl text-primary mb-4 font-mono">
            Scalp smarter. Trade faster. Win more.
          </p>
          <p className="text-sm text-gray-400 mb-8 font-mono">
            No backend. No middleman. Direct to Hyperliquid. Your keys never leave your browser.
          </p>
          <button
            onClick={() => setShowCredentials(true)}
            className="px-6 py-3 border-2 border-primary text-primary hover:bg-primary hover:text-bg-primary font-mono uppercase tracking-wider transition-all text-sm"
          >
            Launch Terminal
          </button>
        </header>

        {showCredentials && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-6">
            <div className="bg-bg-secondary border-2 border-primary p-8 max-w-2xl w-full relative">
              <button
                onClick={() => setShowCredentials(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-primary font-mono text-xl"
              >
                [X]
              </button>
              <div className="mb-6">
                <h2 className="text-2xl font-bold font-mono text-primary mb-2">LET'S GO</h2>
                <p className="text-gray-400 text-sm">Connect your Hyperliquid wallet</p>
              </div>
              <CredentialsSettings />
            </div>
          </div>
        )}

        <section className="mb-20 border-2 border-primary p-6">
          <h2 className="text-2xl font-bold mb-3 font-mono text-primary">100% CLIENT-SIDE</h2>
          <p className="text-gray-300 leading-relaxed mb-0">
            Zero backend servers. Zero data collection. Every API call goes straight from your browser to Hyperliquid.
            Your private keys are encrypted locally and never transmitted anywhere. You own your data. You control your trades.
          </p>
        </section>

        <section className="mb-20">
          <div className="border-l-2 border-primary pl-6 space-y-8">
            <div>
              <h3 className="text-lg font-mono text-primary mb-2">ANALYSIS</h3>
              <p className="text-gray-400 leading-relaxed">
                Real indicators. Real signals. No BS. EMA, MACD, Stochastic with divergence detection and auto-signals.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-mono text-primary mb-2">EXECUTION</h3>
              <p className="text-gray-400 leading-relaxed">
                Hit your entries with cloud ladders. Scale in/out like a pro. Auto TPSL so you can actually sleep.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-mono text-primary mb-2">SCANNER</h3>
              <p className="text-gray-400 leading-relaxed">
                Find setups before everyone else. Multi-symbol scanning with divergence alerts and signal strength scoring.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-mono text-primary mb-2">TRACKING</h3>
              <p className="text-gray-400 leading-relaxed">
                Know your stats. Track P&L, win rate, profit factor. See what works, cut what doesn't.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-20">
          <h2 className="text-3xl font-bold mb-8 font-mono">BUILT FOR SCALPERS</h2>
          <div className="grid md:grid-cols-2 gap-x-12 gap-y-6 text-sm">
            <div>
              <span className="text-primary font-mono">TIMEFRAMES:</span>
              <span className="text-gray-400 ml-2">1m, 5m, 15m, 1h. Fast TFs only. Multi-chart view with sync zoom.</span>
            </div>
            <div>
              <span className="text-primary font-mono">INDICATORS:</span>
              <span className="text-gray-400 ml-2">EMA, MACD, Stochastic. Fully customizable. No bloat.</span>
            </div>
            <div>
              <span className="text-primary font-mono">PATTERNS:</span>
              <span className="text-gray-400 ml-2">Auto divergence detection. Pivots. Support/resistance. Your edge automated.</span>
            </div>
            <div>
              <span className="text-primary font-mono">ORDERS:</span>
              <span className="text-gray-400 ml-2">Cloud ladders for DCA. Instant market fills. Smart position scaling.</span>
            </div>
          </div>
        </section>

        <section className="mb-20 border-t border-frame pt-12">
          <div className="grid md:grid-cols-2 gap-8 text-sm">
            <div className="border-l-2 border-primary pl-4">
              <p className="text-primary font-mono mb-2">01. CONNECT</p>
              <p className="text-gray-400">Plug in your Hyperliquid key. Encrypted locally. Zero backend. All API calls go straight to Hyperliquid.</p>
            </div>
            <div className="border-l-2 border-primary pl-4">
              <p className="text-primary font-mono mb-2">02. SCAN</p>
              <p className="text-gray-400">Scanner shows you the setups. Divergences, signals, everything you need to find your edge.</p>
            </div>
            <div className="border-l-2 border-primary pl-4">
              <p className="text-primary font-mono mb-2">03. SEND IT</p>
              <p className="text-gray-400">Cloud ladders for entries. TPSL set automatically. Position management on point.</p>
            </div>
            <div className="border-l-2 border-primary pl-4">
              <p className="text-primary font-mono mb-2">04. REVIEW</p>
              <p className="text-gray-400">Track every trade. See your win rate. Know your numbers. Improve daily.</p>
            </div>
          </div>
        </section>

        <footer className="border-t border-frame pt-8 pb-4">
          <button
            onClick={() => setShowCredentials(true)}
            className="px-6 py-3 border-2 border-primary text-primary hover:bg-primary hover:text-bg-primary font-mono uppercase tracking-wider transition-all text-sm"
          >
            Launch Terminal
          </button>
        </footer>
      </div>
    </div>
  );
}
