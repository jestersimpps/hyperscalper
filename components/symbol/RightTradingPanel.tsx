'use client';

import { memo } from 'react';
import CrosshairIcon from '@/components/icons/CrosshairIcon';
import QuickCloseButtons from '@/components/layout/QuickCloseButtons';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useCrosshairStore } from '@/stores/useCrosshairStore';
import { formatPnlSchmeckles } from '@/lib/format-utils';
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
  onCancelEntryOrders,
  onCancelExitOrders,
  onCancelAllOrders,
}: RightTradingPanelProps) {
  const hasExitOrders = orders.some(order => order.orderType === 'stop' || order.orderType === 'tp');
  const schmecklesMode = useSettingsStore((state) => state.settings.chart.schmecklesMode);
  const crosshairActive = useCrosshairStore((state) => state.active);
  const crosshairType = useCrosshairStore((state) => state.type);
  const setMode = useCrosshairStore((state) => state.setMode);

  const handleCrosshairClick = (type: 'cloud-long' | 'cloud-short' | 'sm-long' | 'sm-short' | 'big-long' | 'big-short' | 'exit-25' | 'exit-50' | 'exit-75' | 'exit-100') => {
    const newMode = crosshairType === type ? null : type;
    console.log('Crosshair button clicked:', type, '→', newMode ? 'ACTIVE' : 'INACTIVE');
    setMode(newMode);
  };

  return (
    <aside className="w-[200px] border-l-2 border-border-frame overflow-y-auto">
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
                {position
                  ? schmecklesMode
                    ? `${formatPnlSchmeckles(position.pnl, position.size * position.currentPrice)} / ${position.pnlPercentage >= 0 ? '+' : ''}${position.pnlPercentage.toFixed(2)}%`
                    : `${position.pnl >= 0 ? '+' : ''}${position.pnl.toFixed(2)} USD (${position.pnlPercentage >= 0 ? '+' : ''}${position.pnlPercentage.toFixed(2)}%)`
                  : schmecklesMode ? '+- SH' : '+-.-- USD'}
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
              <div className="flex gap-1">
                <button
                  className={`px-2 py-1.5 border rounded-sm transition-all ${
                    crosshairActive && crosshairType === 'cloud-long'
                      ? 'bg-bullish/40 border-bullish/80 shadow-[0_0_12px_rgba(38,166,154,0.6)] animate-pulse'
                      : 'bg-bullish/20 border-bullish/40 hover:bg-bullish/30 hover:border-bullish/60'
                  }`}
                  onClick={() => handleCrosshairClick('cloud-long')}
                  title="Place limit order at clicked price"
                >
                  <CrosshairIcon className="w-4 h-4 text-bullish" />
                </button>
                <button
                  className="flex-1 px-2 py-1.5 bg-bullish/20 border border-bullish/40 text-bullish hover:bg-bullish/30 hover:border-bullish/60 active:bg-bullish/50 active:scale-95 active:shadow-inner transition-all rounded-sm hover:shadow-[0_0_8px_rgba(38,166,154,0.3)] cursor-pointer"
                  onClick={onBuyCloud}
                  title="Place cloud of limit buy orders (hotkey: Q)"
                >
                  <span className="text-bullish/60 text-xs font-bold mr-1">Q</span>
                  █ BUY CLOUD
                </button>
              </div>
              <div className="flex gap-1">
                <button
                  className={`px-2 py-1.5 border rounded-sm transition-all ${
                    crosshairActive && crosshairType === 'cloud-short'
                      ? 'bg-bearish/40 border-bearish/80 shadow-[0_0_12px_rgba(239,83,80,0.6)] animate-pulse'
                      : 'bg-bearish/20 border-bearish/40 hover:bg-bearish/30 hover:border-bearish/60'
                  }`}
                  onClick={() => handleCrosshairClick('cloud-short')}
                  title="Place limit order at clicked price"
                >
                  <CrosshairIcon className="w-4 h-4 text-bearish" />
                </button>
                <button
                  className="flex-1 px-2 py-1.5 bg-bearish/20 border border-bearish/40 text-bearish hover:bg-bearish/30 hover:border-bearish/60 active:bg-bearish/50 active:scale-95 active:shadow-inner transition-all rounded-sm hover:shadow-[0_0_8px_rgba(239,83,80,0.3)] cursor-pointer"
                  onClick={onSellCloud}
                  title="Place cloud of limit sell orders (hotkey: W)"
                >
                  <span className="text-bearish/60 text-xs font-bold mr-1">W</span>
                  █ SELL CLOUD
                </button>
              </div>
              <div className="text-[9px] text-primary-muted/60 uppercase tracking-wider mt-2 mb-0.5">Small</div>
              <div className="flex gap-1">
                <button
                  className={`px-2 py-1.5 border rounded-sm transition-all ${
                    crosshairActive && crosshairType === 'sm-long'
                      ? 'bg-bullish/40 border-bullish/80 shadow-[0_0_12px_rgba(38,166,154,0.6)] animate-pulse'
                      : 'bg-bullish/20 border-bullish/40 hover:bg-bullish/30 hover:border-bullish/60'
                  }`}
                  onClick={() => handleCrosshairClick('sm-long')}
                  title="Place limit order at clicked price"
                >
                  <CrosshairIcon className="w-4 h-4 text-bullish" />
                </button>
                <button
                  className="flex-1 px-2 py-1.5 bg-bullish/20 border border-bullish/40 text-bullish hover:bg-bullish/30 hover:border-bullish/60 active:bg-bullish/50 active:scale-95 active:shadow-inner transition-all rounded-sm hover:shadow-[0_0_8px_rgba(38,166,154,0.3)] cursor-pointer"
                  onClick={onSmLong}
                  title="Place small long position (hotkey: A)"
                >
                  <span className="text-bullish/60 text-xs font-bold mr-1">A</span>
                  █ SM LONG
                </button>
              </div>
              <div className="flex gap-1">
                <button
                  className={`px-2 py-1.5 border rounded-sm transition-all ${
                    crosshairActive && crosshairType === 'sm-short'
                      ? 'bg-bearish/40 border-bearish/80 shadow-[0_0_12px_rgba(239,83,80,0.6)] animate-pulse'
                      : 'bg-bearish/20 border-bearish/40 hover:bg-bearish/30 hover:border-bearish/60'
                  }`}
                  onClick={() => handleCrosshairClick('sm-short')}
                  title="Place limit order at clicked price"
                >
                  <CrosshairIcon className="w-4 h-4 text-bearish" />
                </button>
                <button
                  className="flex-1 px-2 py-1.5 bg-bearish/20 border border-bearish/40 text-bearish hover:bg-bearish/30 hover:border-bearish/60 active:bg-bearish/50 active:scale-95 active:shadow-inner transition-all rounded-sm hover:shadow-[0_0_8px_rgba(239,83,80,0.3)] cursor-pointer"
                  onClick={onSmShort}
                  title="Place small short position (hotkey: S)"
                >
                  <span className="text-bearish/60 text-xs font-bold mr-1">S</span>
                  █ SM SHORT
                </button>
              </div>
              <div className="text-[9px] text-primary-muted/60 uppercase tracking-wider mt-2 mb-0.5">Big</div>
              <div className="flex gap-1">
                <button
                  className={`px-2 py-1.5 border-2 rounded-sm transition-all ${
                    crosshairActive && crosshairType === 'big-long'
                      ? 'bg-bullish/50 border-bullish/90 shadow-[0_0_14px_rgba(38,166,154,0.7)] animate-pulse'
                      : 'bg-bullish/30 border-bullish/60 hover:bg-bullish/40 hover:border-bullish/80'
                  }`}
                  onClick={() => handleCrosshairClick('big-long')}
                  title="Place limit order at clicked price"
                >
                  <CrosshairIcon className="w-4 h-4 text-bullish" />
                </button>
                <button
                  className="flex-1 px-2 py-1.5 bg-bullish/30 border-2 border-bullish/60 text-bullish font-bold hover:bg-bullish/40 hover:border-bullish/80 active:bg-bullish/60 active:scale-95 active:shadow-inner transition-all rounded-sm hover:shadow-[0_0_10px_rgba(38,166,154,0.5)] cursor-pointer"
                  onClick={onBigLong}
                  title="Place big long position (hotkey: Shift+A)"
                >
                  <span className="text-bullish/60 text-xs font-bold mr-1">⇧A</span>
                  ██ BIG LONG
                </button>
              </div>
              <div className="flex gap-1">
                <button
                  className={`px-2 py-1.5 border-2 rounded-sm transition-all ${
                    crosshairActive && crosshairType === 'big-short'
                      ? 'bg-bearish/50 border-bearish/90 shadow-[0_0_14px_rgba(239,83,80,0.7)] animate-pulse'
                      : 'bg-bearish/30 border-bearish/60 hover:bg-bearish/40 hover:border-bearish/80'
                  }`}
                  onClick={() => handleCrosshairClick('big-short')}
                  title="Place limit order at clicked price"
                >
                  <CrosshairIcon className="w-4 h-4 text-bearish" />
                </button>
                <button
                  className="flex-1 px-2 py-1.5 bg-bearish/30 border-2 border-bearish/60 text-bearish font-bold hover:bg-bearish/40 hover:border-bearish/80 active:bg-bearish/60 active:scale-95 active:shadow-inner transition-all rounded-sm hover:shadow-[0_0_10px_rgba(239,83,80,0.5)] cursor-pointer"
                  onClick={onBigShort}
                  title="Place big short position (hotkey: Shift+S)"
                >
                  <span className="text-bearish/60 text-xs font-bold mr-1">⇧S</span>
                  ██ BIG SHORT
                </button>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-border-frame">
            <div className="text-[10px] text-primary-muted mb-2 uppercase tracking-wider">█ EXIT ORDERS</div>
            <div className="grid grid-cols-4 gap-1.5">
              <button
                className={`w-full aspect-square flex flex-col items-center justify-center border transition-all rounded-sm text-[8px] font-bold disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100 ${
                  crosshairType === 'exit-25'
                    ? 'bg-accent-cyan/40 border-accent-cyan/80 shadow-[0_0_12px_rgba(68,186,186,0.6)] animate-pulse cursor-pointer'
                    : 'bg-accent-cyan/10 border-accent-cyan/30 text-accent-cyan hover:bg-accent-cyan/20 hover:border-accent-cyan/50 active:bg-accent-cyan/30 active:scale-95 cursor-pointer'
                }`}
                onClick={() => handleCrosshairClick('exit-25')}
                disabled={!position}
                title="Click to place 25% exit order on chart"
              >
                <CrosshairIcon className={crosshairType === 'exit-25' ? 'text-accent-cyan' : 'text-accent-cyan/60'} />
                <span className="mt-0.5">25%</span>
              </button>
              <button
                className={`w-full aspect-square flex flex-col items-center justify-center border transition-all rounded-sm text-[8px] font-bold disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100 ${
                  crosshairType === 'exit-50'
                    ? 'bg-accent-cyan/40 border-accent-cyan/80 shadow-[0_0_12px_rgba(68,186,186,0.6)] animate-pulse cursor-pointer'
                    : 'bg-accent-cyan/10 border-accent-cyan/30 text-accent-cyan hover:bg-accent-cyan/20 hover:border-accent-cyan/50 active:bg-accent-cyan/30 active:scale-95 cursor-pointer'
                }`}
                onClick={() => handleCrosshairClick('exit-50')}
                disabled={!position}
                title="Click to place 50% exit order on chart"
              >
                <CrosshairIcon className={crosshairType === 'exit-50' ? 'text-accent-cyan' : 'text-accent-cyan/60'} />
                <span className="mt-0.5">50%</span>
              </button>
              <button
                className={`w-full aspect-square flex flex-col items-center justify-center border transition-all rounded-sm text-[8px] font-bold disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100 ${
                  crosshairType === 'exit-75'
                    ? 'bg-accent-cyan/40 border-accent-cyan/80 shadow-[0_0_12px_rgba(68,186,186,0.6)] animate-pulse cursor-pointer'
                    : 'bg-accent-cyan/10 border-accent-cyan/30 text-accent-cyan hover:bg-accent-cyan/20 hover:border-accent-cyan/50 active:bg-accent-cyan/30 active:scale-95 cursor-pointer'
                }`}
                onClick={() => handleCrosshairClick('exit-75')}
                disabled={!position}
                title="Click to place 75% exit order on chart"
              >
                <CrosshairIcon className={crosshairType === 'exit-75' ? 'text-accent-cyan' : 'text-accent-cyan/60'} />
                <span className="mt-0.5">75%</span>
              </button>
              <button
                className={`w-full aspect-square flex flex-col items-center justify-center border transition-all rounded-sm text-[8px] font-bold disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100 ${
                  crosshairType === 'exit-100'
                    ? 'bg-accent-cyan/40 border-accent-cyan/80 shadow-[0_0_12px_rgba(68,186,186,0.6)] animate-pulse cursor-pointer'
                    : 'bg-accent-cyan/10 border-accent-cyan/30 text-accent-cyan hover:bg-accent-cyan/20 hover:border-accent-cyan/50 active:bg-accent-cyan/30 active:scale-95 cursor-pointer'
                }`}
                onClick={() => handleCrosshairClick('exit-100')}
                disabled={!position}
                title="Click to place 100% exit order on chart"
              >
                <CrosshairIcon className={crosshairType === 'exit-100' ? 'text-accent-cyan' : 'text-accent-cyan/60'} />
                <span className="mt-0.5">100%</span>
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
                  title="Close 25% of current position (hotkey: 1)"
                >
                  <span className="text-accent-violet/60 text-xs font-bold mr-1">1</span>
                  25%
                </button>
                <button
                  className="px-2 py-1.5 bg-accent-violet/10 border border-accent-violet/30 text-accent-violet hover:bg-accent-violet/20 hover:border-accent-violet/50 active:bg-accent-violet/30 active:scale-95 active:shadow-inner transition-all rounded-sm hover:shadow-[0_0_8px_rgba(150,100,200,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer"
                  onClick={onClose50}
                  disabled={!position}
                  title="Close 50% of current position (hotkey: 2)"
                >
                  <span className="text-accent-violet/60 text-xs font-bold mr-1">2</span>
                  50%
                </button>
                <button
                  className="px-2 py-1.5 bg-accent-violet/10 border border-accent-violet/30 text-accent-violet hover:bg-accent-violet/20 hover:border-accent-violet/50 active:bg-accent-violet/30 active:scale-95 active:shadow-inner transition-all rounded-sm hover:shadow-[0_0_8px_rgba(150,100,200,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer"
                  onClick={onClose75}
                  disabled={!position}
                  title="Close 75% of current position (hotkey: 3)"
                >
                  <span className="text-accent-violet/60 text-xs font-bold mr-1">3</span>
                  75%
                </button>
                <button
                  className="px-2 py-1.5 bg-accent-violet/10 border border-accent-violet/30 text-accent-violet hover:bg-accent-violet/20 hover:border-accent-violet/50 active:bg-accent-violet/30 active:scale-95 active:shadow-inner transition-all rounded-sm hover:shadow-[0_0_8px_rgba(150,100,200,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer"
                  onClick={onClose100}
                  disabled={!position}
                  title="Close 100% of current position (hotkey: 4)"
                >
                  <span className="text-accent-violet/60 text-xs font-bold mr-1">4</span>
                  100%
                </button>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-border-frame">
            <div className="text-[10px] text-primary-muted mb-2 uppercase tracking-wider">█ ORDERS</div>
            <div className="flex flex-col gap-1.5">
              <button
                className="w-full px-2 py-1.5 bg-accent-orange/10 border border-accent-orange/30 text-accent-orange hover:bg-accent-orange/20 hover:border-accent-orange/50 active:bg-accent-orange/30 active:scale-95 active:shadow-inner transition-all rounded-sm hover:shadow-[0_0_8px_rgba(255,165,0,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer text-[10px] font-mono"
                onClick={onCancelEntryOrders}
                disabled={orders.length === 0}
                title="Cancel all pending entry orders for this symbol"
              >
                ✕ CANCEL ENTRY ORDERS
              </button>
              <button
                className="w-full px-2 py-1.5 bg-accent-orange/10 border border-accent-orange/30 text-accent-orange hover:bg-accent-orange/20 hover:border-accent-orange/50 active:bg-accent-orange/30 active:scale-95 active:shadow-inner transition-all rounded-sm hover:shadow-[0_0_8px_rgba(255,165,0,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer text-[10px] font-mono"
                onClick={onCancelExitOrders}
                disabled={!hasExitOrders}
                title="Cancel all stop loss and take profit orders for this symbol"
              >
                ✕ CANCEL EXIT ORDERS
              </button>
              <button
                className="w-full px-2 py-1.5 bg-accent-orange/10 border border-accent-orange/30 text-accent-orange hover:bg-accent-orange/20 hover:border-accent-orange/50 active:bg-accent-orange/30 active:scale-95 active:shadow-inner transition-all rounded-sm hover:shadow-[0_0_8px_rgba(255,165,0,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer text-[10px] font-mono"
                onClick={onCancelAllOrders}
                disabled={orders.length === 0}
                title="Cancel all orders (entry and exit) for this symbol"
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
