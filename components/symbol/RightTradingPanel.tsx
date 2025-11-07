'use client';

import { memo } from 'react';
import QuickCloseButtons from '@/components/layout/QuickCloseButtons';
import type { Position } from '@/models/Position';
import type { Order } from '@/models/Order';

interface RightTradingPanelProps {
  coin: string;
  position?: Position | null;
  orders: Order[];
  decimals: { price: number; size: number };
  onBuyCloud: () => void;
  onSellCloud: () => void;
  onSmLong: () => void;
  onSmShort: () => void;
  onBigLong: () => void;
  onBigShort: () => void;
  onClose25: () => void;
  onClose50: () => void;
  onClose75: () => void;
  onClose100: () => void;
  onMoveSL25: () => void;
  onMoveSL50: () => void;
  onMoveSL75: () => void;
  onMoveSLBreakeven: () => void;
  onCancelEntryOrders: () => void;
  onCancelExitOrders: () => void;
  onCancelAllOrders: () => void;
}

function RightTradingPanel({
  coin,
  position,
  orders,
  decimals,
  onBuyCloud,
  onSellCloud,
  onSmLong,
  onSmShort,
  onBigLong,
  onBigShort,
  onClose25,
  onClose50,
  onClose75,
  onClose100,
  onMoveSL25,
  onMoveSL50,
  onMoveSL75,
  onMoveSLBreakeven,
  onCancelEntryOrders,
  onCancelExitOrders,
  onCancelAllOrders,
}: RightTradingPanelProps) {
  const hasExitOrders = orders.some(order => order.orderType === 'stop' || order.orderType === 'tp');

  return (
    <aside className="w-80 border-l-2 border-border-frame overflow-y-auto">
      <div className="p-2 flex flex-col gap-2">
        <div className="terminal-border p-1.5 flex flex-col">
          <div className="text-[12px] text-primary-muted mb-1.5 uppercase tracking-wider">█ POSITION</div>
          <div className="text-[12px] space-y-1 font-mono">
            <div className="flex justify-between">
              <span className="text-primary-muted">SIZE:</span>
              <span className={position ? (position.side === 'long' ? 'text-bullish' : 'text-bearish') : 'text-primary'}>
                {position ? `${position.size.toFixed(decimals.size)} ${coin} ${position.side.toUpperCase()}` : `-- ${coin}`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-primary-muted">VALUE:</span>
              <span className="text-primary">
                {position ? `$${(position.size * position.currentPrice).toFixed(2)}` : '$---.--'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-primary-muted">ENTRY:</span>
              <span className="text-primary">
                {position ? position.entryPrice.toFixed(decimals.price) : '---.--'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-primary-muted">PNL:</span>
              <span className={position ? (position.pnl >= 0 ? 'text-bullish' : 'text-bearish') : 'text-primary'}>
                {position ? `${position.pnl >= 0 ? '+' : ''}${position.pnl.toFixed(2)} USD (${position.pnlPercentage >= 0 ? '+' : ''}${position.pnlPercentage.toFixed(2)}%)` : '+-.-- USD'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-primary-muted">LEVERAGE:</span>
              <span className="text-primary">
                {position ? `${position.leverage}x` : '--x'}
              </span>
            </div>
          </div>
        </div>

        <div className="terminal-border p-1.5 flex flex-col gap-3">
          <div>
            <div className="text-[10px] text-primary-muted mb-2 uppercase tracking-wider">█ ENTRY ORDERS</div>
            <div className="flex flex-col gap-1.5 text-[10px] font-mono">
              <div className="text-[9px] text-primary-muted/60 uppercase tracking-wider mb-0.5">Cloud</div>
              <button
                className="w-full px-2 py-1.5 bg-bullish/20 border border-bullish/40 text-bullish hover:bg-bullish/30 hover:border-bullish/60 active:bg-bullish/50 active:scale-95 active:shadow-inner transition-all rounded-sm hover:shadow-[0_0_8px_rgba(38,166,154,0.3)] cursor-pointer"
                onClick={onBuyCloud}
              >
                <span className="text-bullish/60 text-xs font-bold mr-1">Q</span>
                █ BUY CLOUD
              </button>
              <button
                className="w-full px-2 py-1.5 bg-bearish/20 border border-bearish/40 text-bearish hover:bg-bearish/30 hover:border-bearish/60 active:bg-bearish/50 active:scale-95 active:shadow-inner transition-all rounded-sm hover:shadow-[0_0_8px_rgba(239,83,80,0.3)] cursor-pointer"
                onClick={onSellCloud}
              >
                <span className="text-bearish/60 text-xs font-bold mr-1">W</span>
                █ SELL CLOUD
              </button>
              <div className="text-[9px] text-primary-muted/60 uppercase tracking-wider mt-2 mb-0.5">Small</div>
              <button
                className="w-full px-2 py-1.5 bg-bullish/20 border border-bullish/40 text-bullish hover:bg-bullish/30 hover:border-bullish/60 active:bg-bullish/50 active:scale-95 active:shadow-inner transition-all rounded-sm hover:shadow-[0_0_8px_rgba(38,166,154,0.3)] cursor-pointer"
                onClick={onSmLong}
              >
                <span className="text-bullish/60 text-xs font-bold mr-1">A</span>
                █ SM LONG
              </button>
              <button
                className="w-full px-2 py-1.5 bg-bearish/20 border border-bearish/40 text-bearish hover:bg-bearish/30 hover:border-bearish/60 active:bg-bearish/50 active:scale-95 active:shadow-inner transition-all rounded-sm hover:shadow-[0_0_8px_rgba(239,83,80,0.3)] cursor-pointer"
                onClick={onSmShort}
              >
                <span className="text-bearish/60 text-xs font-bold mr-1">S</span>
                █ SM SHORT
              </button>
              <div className="text-[9px] text-primary-muted/60 uppercase tracking-wider mt-2 mb-0.5">Big</div>
              <button
                className="w-full px-2 py-1.5 bg-bullish/30 border-2 border-bullish/60 text-bullish font-bold hover:bg-bullish/40 hover:border-bullish/80 active:bg-bullish/60 active:scale-95 active:shadow-inner transition-all rounded-sm hover:shadow-[0_0_10px_rgba(38,166,154,0.5)] cursor-pointer"
                onClick={onBigLong}
              >
                <span className="text-bullish/60 text-xs font-bold mr-1">⇧A</span>
                ██ BIG LONG
              </button>
              <button
                className="w-full px-2 py-1.5 bg-bearish/30 border-2 border-bearish/60 text-bearish font-bold hover:bg-bearish/40 hover:border-bearish/80 active:bg-bearish/60 active:scale-95 active:shadow-inner transition-all rounded-sm hover:shadow-[0_0_10px_rgba(239,83,80,0.5)] cursor-pointer"
                onClick={onBigShort}
              >
                <span className="text-bearish/60 text-xs font-bold mr-1">⇧S</span>
                ██ BIG SHORT
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-border-frame">
            <div className="text-[10px] text-primary-muted mb-2 uppercase tracking-wider">█ CLOSE POSITION</div>
            <div className="flex flex-col gap-1.5">
              <div className="text-[9px] text-primary-muted/60 uppercase tracking-wider mb-0.5">Global</div>
              <QuickCloseButtons />
              <div className="text-[9px] text-primary-muted/60 uppercase tracking-wider mt-2 mb-0.5">Current ({coin})</div>
              <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                <button
                  className="px-2 py-1.5 bg-accent-violet/10 border border-accent-violet/30 text-accent-violet hover:bg-accent-violet/20 hover:border-accent-violet/50 active:bg-accent-violet/30 active:scale-95 active:shadow-inner transition-all rounded-sm hover:shadow-[0_0_8px_rgba(150,100,200,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer"
                  onClick={onClose25}
                  disabled={!position}
                >
                  <span className="text-accent-violet/60 text-xs font-bold mr-1">1</span>
                  25%
                </button>
                <button
                  className="px-2 py-1.5 bg-accent-violet/10 border border-accent-violet/30 text-accent-violet hover:bg-accent-violet/20 hover:border-accent-violet/50 active:bg-accent-violet/30 active:scale-95 active:shadow-inner transition-all rounded-sm hover:shadow-[0_0_8px_rgba(150,100,200,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer"
                  onClick={onClose50}
                  disabled={!position}
                >
                  <span className="text-accent-violet/60 text-xs font-bold mr-1">2</span>
                  50%
                </button>
                <button
                  className="px-2 py-1.5 bg-accent-violet/10 border border-accent-violet/30 text-accent-violet hover:bg-accent-violet/20 hover:border-accent-violet/50 active:bg-accent-violet/30 active:scale-95 active:shadow-inner transition-all rounded-sm hover:shadow-[0_0_8px_rgba(150,100,200,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer"
                  onClick={onClose75}
                  disabled={!position}
                >
                  <span className="text-accent-violet/60 text-xs font-bold mr-1">3</span>
                  75%
                </button>
                <button
                  className="px-2 py-1.5 bg-accent-violet/10 border border-accent-violet/30 text-accent-violet hover:bg-accent-violet/20 hover:border-accent-violet/50 active:bg-accent-violet/30 active:scale-95 active:shadow-inner transition-all rounded-sm hover:shadow-[0_0_8px_rgba(150,100,200,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer"
                  onClick={onClose100}
                  disabled={!position}
                >
                  <span className="text-accent-violet/60 text-xs font-bold mr-1">4</span>
                  100%
                </button>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-border-frame">
            <div className="text-[10px] text-primary-muted mb-2 uppercase tracking-wider">█ STOP LOSS</div>
            <div className="flex flex-col gap-1.5 text-[10px] font-mono">
              <button
                className="w-full px-2 py-1.5 bg-accent-violet/10 border border-accent-violet/30 text-accent-violet hover:bg-accent-violet/20 hover:border-accent-violet/50 active:bg-accent-violet/30 active:scale-95 active:shadow-inner transition-all rounded-sm hover:shadow-[0_0_8px_rgba(150,100,200,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer"
                onClick={onMoveSL25}
                disabled={!position}
              >
                <span className="text-accent-violet/60 text-xs font-bold mr-1">5</span>
                ⟰ SL 25%
              </button>
              <button
                className="w-full px-2 py-1.5 bg-accent-violet/10 border border-accent-violet/30 text-accent-violet hover:bg-accent-violet/20 hover:border-accent-violet/50 active:bg-accent-violet/30 active:scale-95 active:shadow-inner transition-all rounded-sm hover:shadow-[0_0_8px_rgba(150,100,200,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer"
                onClick={onMoveSL50}
                disabled={!position}
              >
                <span className="text-accent-violet/60 text-xs font-bold mr-1">6</span>
                ⟰ SL 50%
              </button>
              <button
                className="w-full px-2 py-1.5 bg-accent-violet/10 border border-accent-violet/30 text-accent-violet hover:bg-accent-violet/20 hover:border-accent-violet/50 active:bg-accent-violet/30 active:scale-95 active:shadow-inner transition-all rounded-sm hover:shadow-[0_0_8px_rgba(150,100,200,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer"
                onClick={onMoveSL75}
                disabled={!position}
              >
                <span className="text-accent-violet/60 text-xs font-bold mr-1">7</span>
                ⟰ SL 75%
              </button>
              <button
                className="w-full px-2 py-1.5 bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan hover:bg-accent-cyan/20 hover:border-accent-cyan/50 active:bg-accent-cyan/30 active:scale-95 active:shadow-inner transition-all rounded-sm hover:shadow-[0_0_8px_rgba(68,186,186,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer"
                onClick={onMoveSLBreakeven}
                disabled={!position}
              >
                <span className="text-accent-cyan/60 text-xs font-bold mr-1">8</span>
                ⟰ BREAKEVEN
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-border-frame">
            <div className="text-[10px] text-primary-muted mb-2 uppercase tracking-wider">█ ORDERS</div>
            <div className="flex flex-col gap-1.5">
              <button
                className="w-full px-2 py-1.5 bg-accent-orange/10 border border-accent-orange/30 text-accent-orange hover:bg-accent-orange/20 hover:border-accent-orange/50 active:bg-accent-orange/30 active:scale-95 active:shadow-inner transition-all rounded-sm hover:shadow-[0_0_8px_rgba(255,165,0,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer text-[10px] font-mono"
                onClick={onCancelEntryOrders}
                disabled={orders.length === 0}
              >
                ✕ CANCEL ENTRY ORDERS
              </button>
              <button
                className="w-full px-2 py-1.5 bg-accent-orange/10 border border-accent-orange/30 text-accent-orange hover:bg-accent-orange/20 hover:border-accent-orange/50 active:bg-accent-orange/30 active:scale-95 active:shadow-inner transition-all rounded-sm hover:shadow-[0_0_8px_rgba(255,165,0,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer text-[10px] font-mono"
                onClick={onCancelExitOrders}
                disabled={!hasExitOrders}
              >
                ✕ CANCEL EXIT ORDERS
              </button>
              <button
                className="w-full px-2 py-1.5 bg-accent-orange/10 border border-accent-orange/30 text-accent-orange hover:bg-accent-orange/20 hover:border-accent-orange/50 active:bg-accent-orange/30 active:scale-95 active:shadow-inner transition-all rounded-sm hover:shadow-[0_0_8px_rgba(255,165,0,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer text-[10px] font-mono"
                onClick={onCancelAllOrders}
                disabled={orders.length === 0}
              >
                ✕ CANCEL ALL ORDERS
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default memo(RightTradingPanel);
