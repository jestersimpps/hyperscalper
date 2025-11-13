'use client';

import type { WalletStatistics as WalletStatsType } from '@/models/WatchedWallet';

interface WalletStatisticsProps {
  statistics: WalletStatsType;
}

export default function WalletStatistics({ statistics }: WalletStatisticsProps) {
  const {
    totalPnl,
    winRate,
    profitFactor,
    totalTrades,
    avgWin,
    avgLoss,
    totalFees,
    unrealizedPnl
  } = statistics;

  const realizedPnl = totalPnl;
  const totalPnlWithUnrealized = realizedPnl + unrealizedPnl;
  const totalPnlColor = totalPnlWithUnrealized > 0 ? 'text-bullish' : totalPnlWithUnrealized < 0 ? 'text-bearish' : 'text-primary-muted';
  const realizedPnlColor = realizedPnl > 0 ? 'text-bullish' : realizedPnl < 0 ? 'text-bearish' : 'text-primary-muted';
  const unrealizedPnlColor = unrealizedPnl > 0 ? 'text-bullish' : unrealizedPnl < 0 ? 'text-bearish' : 'text-primary-muted';

  return (
    <div className="bg-bg-secondary p-2 rounded">
      <div className="text-[10px] text-primary-muted uppercase mb-2 font-bold">Performance Statistics</div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="bg-bg-primary p-2 rounded">
          <div className="text-[8px] text-primary-muted uppercase">Total P&L</div>
          <div className={`text-[11px] font-bold ${totalPnlColor}`}>
            ${totalPnlWithUnrealized.toFixed(2)}
          </div>
        </div>

        <div className="bg-bg-primary p-2 rounded">
          <div className="text-[8px] text-primary-muted uppercase">Win Rate</div>
          <div className="text-[11px] font-bold text-primary">
            {winRate.toFixed(1)}%
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-2">
        <div className="bg-bg-primary p-2 rounded">
          <div className="text-[8px] text-primary-muted uppercase">Realized</div>
          <div className={`text-[10px] font-bold ${realizedPnlColor}`}>
            ${realizedPnl.toFixed(2)}
          </div>
        </div>

        <div className="bg-bg-primary p-2 rounded">
          <div className="text-[8px] text-primary-muted uppercase">Unrealized</div>
          <div className={`text-[10px] font-bold ${unrealizedPnlColor}`}>
            ${unrealizedPnl.toFixed(2)}
          </div>
        </div>

        <div className="bg-bg-primary p-2 rounded">
          <div className="text-[8px] text-primary-muted uppercase">Total Fees</div>
          <div className="text-[10px] font-bold text-bearish">
            ${totalFees.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-bg-primary p-2 rounded">
          <div className="text-[8px] text-primary-muted uppercase">Profit Factor</div>
          <div className="text-[10px] font-bold text-primary">
            {profitFactor === Infinity ? '∞' : profitFactor.toFixed(2)}
          </div>
        </div>

        <div className="bg-bg-primary p-2 rounded">
          <div className="text-[8px] text-primary-muted uppercase">Avg Win</div>
          <div className="text-[10px] font-bold text-bullish">
            ${avgWin.toFixed(2)}
          </div>
        </div>

        <div className="bg-bg-primary p-2 rounded">
          <div className="text-[8px] text-primary-muted uppercase">Avg Loss</div>
          <div className="text-[10px] font-bold text-bearish">
            ${avgLoss.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-frame text-center">
        <span className="text-[9px] text-primary-muted">
          Total Trades: <span className="text-primary font-bold">{totalTrades}</span>
        </span>
      </div>
    </div>
  );
}
