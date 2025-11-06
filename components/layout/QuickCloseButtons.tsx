'use client';

import { useState } from 'react';
import { usePositionStore } from '@/stores/usePositionStore';

export default function QuickCloseButtons() {
  const [isClosing, setIsClosing] = useState(false);
  const positions = usePositionStore((state) => state.positions);

  const profitablePositions = Object.entries(positions)
    .filter(([_, pos]) => pos && pos.pnl > 0)
    .map(([symbol, pos]) => ({ symbol, ...pos! }))
    .sort((a, b) => b.pnl - a.pnl);

  const mostProfitable = profitablePositions[0];
  const totalProfit = profitablePositions.reduce((sum, pos) => sum + pos.pnl, 0);

  const closePosition = async (symbol: string) => {
    try {
      const response = await fetch('/api/positions/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, percentage: 100 }),
      });

      const data = await response.json();
      if (!data.success) {
        alert(`Failed to close ${symbol}: ${data.message}`);
      }
    } catch (error) {
      alert(`Error closing ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleCloseBest = async () => {
    if (!mostProfitable || isClosing) return;

    if (!confirm(`Close ${mostProfitable.symbol} position? (+$${mostProfitable.pnl.toFixed(2)})`)) return;

    setIsClosing(true);
    try {
      await closePosition(mostProfitable.symbol);
    } finally {
      setIsClosing(false);
    }
  };

  const handleCloseAllProfitable = async () => {
    if (profitablePositions.length === 0 || isClosing) return;

    const positionText = profitablePositions.length === 1 ? 'position' : 'positions';
    if (!confirm(`Close ${profitablePositions.length} profitable ${positionText}? (Total: +$${totalProfit.toFixed(2)})`)) return;

    setIsClosing(true);
    try {
      for (const pos of profitablePositions) {
        await closePosition(pos.symbol);
      }
    } finally {
      setIsClosing(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <button
        onClick={handleCloseBest}
        disabled={isClosing || !mostProfitable}
        className="w-full px-2 py-1.5 text-[10px] font-mono bg-bullish/10 hover:bg-bullish/20 active:bg-bullish/30 active:scale-95 text-bullish border border-bullish rounded-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all hover:shadow-[0_0_8px_rgba(38,166,154,0.3)]"
        title={mostProfitable ? `Close ${mostProfitable.symbol} (Shift+X)` : 'No profitable positions (Shift+X)'}
      >
        {isClosing ? '⟳' : mostProfitable ? `⇧X ${mostProfitable.symbol} +$${mostProfitable.pnl.toFixed(2)}` : '⇧X ---'}
      </button>
      <button
        onClick={handleCloseAllProfitable}
        disabled={isClosing || profitablePositions.length === 0}
        className="w-full px-2 py-1.5 text-[10px] font-mono bg-bullish/10 hover:bg-bullish/20 active:bg-bullish/30 active:scale-95 text-bullish border border-bullish rounded-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all hover:shadow-[0_0_8px_rgba(38,166,154,0.3)]"
        title={profitablePositions.length > 0 ? `Close ${profitablePositions.length} profitable ${profitablePositions.length === 1 ? 'position' : 'positions'} (Shift+C)` : 'No profitable positions (Shift+C)'}
      >
        {isClosing ? '⟳' : `⇧C ALL (${profitablePositions.length}) +$${totalProfit.toFixed(2)}`}
      </button>
    </div>
  );
}
