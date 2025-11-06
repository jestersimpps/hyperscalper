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

    if (!confirm(`Close ${profitablePositions.length} profitable positions? (Total: +$${totalProfit.toFixed(2)})`)) return;

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
    <div className="flex gap-2">
      {mostProfitable && (
        <button
          onClick={handleCloseBest}
          disabled={isClosing}
          className="px-2 py-1 text-[10px] bg-bullish/10 hover:bg-bullish/20 active:bg-bullish/30 active:scale-95 text-bullish border border-bullish rounded disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all"
          title={`Close ${mostProfitable.symbol} (Shift+X)`}
        >
          {isClosing ? '⟳' : `⇧X +$${mostProfitable.pnl.toFixed(2)}`}
        </button>
      )}
      {profitablePositions.length > 1 && (
        <button
          onClick={handleCloseAllProfitable}
          disabled={isClosing}
          className="px-2 py-1 text-[10px] bg-bullish/10 hover:bg-bullish/20 active:bg-bullish/30 active:scale-95 text-bullish border border-bullish rounded disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all"
          title={`Close ${profitablePositions.length} profitable positions (Shift+C)`}
        >
          {isClosing ? '⟳' : `⇧C +$${totalProfit.toFixed(2)}`}
        </button>
      )}
    </div>
  );
}
