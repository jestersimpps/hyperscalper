'use client';

import type { WalletData, WalletChangeEvent } from '@/models/WatchedWallet';
import WalletStatistics from './WalletStatistics';

interface WalletDetailPanelProps {
  data: WalletData;
}

const formatChangeType = (type: string): string => {
  switch (type) {
    case 'position_opened': return 'OPENED';
    case 'position_closed': return 'CLOSED';
    case 'position_reduced': return 'REDUCED';
    case 'order_placed': return 'PLACED';
    case 'order_cancelled': return 'CANCELLED';
    default: return type.toUpperCase();
  }
};

const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export default function WalletDetailPanel({ data }: WalletDetailPanelProps) {
  const { positions, orders, recentFills, statistics, balance, changeHistory = [] } = data;

  return (
    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-frame">
      {/* Left Column - Current Data */}
      <div className="space-y-3">
        {statistics && <WalletStatistics statistics={statistics} />}

      {balance && (
        <div className="bg-bg-secondary p-2 rounded">
          <div className="text-[10px] text-primary-muted uppercase mb-2 font-bold">Account Balance</div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <div className="text-[8px] text-primary-muted">Account Value</div>
              <div className="text-[10px] text-primary font-bold">
                ${parseFloat(balance.accountValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div>
              <div className="text-[8px] text-primary-muted">Margin Used</div>
              <div className="text-[10px] text-primary font-bold">
                ${parseFloat(balance.marginUsed).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div>
              <div className="text-[8px] text-primary-muted">Withdrawable</div>
              <div className="text-[10px] text-primary font-bold">
                ${parseFloat(balance.withdrawable).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>
      )}

      {positions.length > 0 && (
        <div className="bg-bg-secondary p-2 rounded">
          <div className="text-[10px] text-primary-muted uppercase mb-2 font-bold">
            Open Positions ({positions.length})
          </div>
          <div className="space-y-1 max-h-[200px] overflow-y-auto">
            {positions.map((pos, idx) => {
              const szi = parseFloat(pos.position.szi);
              const entryPx = parseFloat(pos.position.entryPx);
              const positionValue = parseFloat(pos.position.positionValue);
              const unrealizedPnl = parseFloat(pos.position.unrealizedPnl);
              const side = szi > 0 ? 'long' : 'short';
              const pnlColor = unrealizedPnl > 0 ? 'text-bullish' : unrealizedPnl < 0 ? 'text-bearish' : 'text-primary-muted';

              return (
                <div key={idx} className="flex items-center justify-between p-1.5 bg-bg-primary rounded text-[9px]">
                  <div className="flex items-center gap-2">
                    <span className="text-primary font-bold">{pos.position.coin}</span>
                    <span className={side === 'long' ? 'text-bullish' : 'text-bearish'}>
                      {side.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div>
                      <span className="text-primary-muted">Size: </span>
                      <span className="text-primary">{Math.abs(szi).toFixed(4)}</span>
                    </div>
                    <div>
                      <span className="text-primary-muted">Entry: </span>
                      <span className="text-primary">${entryPx.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-primary-muted">P&L: </span>
                      <span className={pnlColor}>${unrealizedPnl.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {orders.length > 0 && (
        <div className="bg-bg-secondary p-2 rounded">
          <div className="text-[10px] text-primary-muted uppercase mb-2 font-bold">
            Pending Orders ({orders.length})
          </div>
          <div className="space-y-1 max-h-[200px] overflow-y-auto">
            {orders.map((order) => {
              const side = order.side === 'A' ? 'sell' : 'buy';
              const isBuy = side === 'buy';
              const sideColor = isBuy ? 'text-bullish' : 'text-bearish';
              const size = Math.abs(parseFloat(order.origSz || order.sz || '0'));
              const price = order.isTrigger ? parseFloat(order.triggerPx || '0') : parseFloat(order.limitPx || '0');

              return (
                <div key={order.oid} className="flex items-center justify-between p-1.5 bg-bg-primary rounded text-[9px]">
                  <div className="flex items-center gap-2">
                    <span className="text-primary font-bold">{order.coin}</span>
                    <span className={sideColor}>{side.toUpperCase()}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div>
                      <span className="text-primary-muted">Size: </span>
                      <span className="text-primary">{size.toFixed(4)}</span>
                    </div>
                    <div>
                      <span className="text-primary-muted">Price: </span>
                      <span className="text-primary">${price.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {recentFills.length > 0 && (
        <div className="bg-bg-secondary p-2 rounded">
          <div className="text-[10px] text-primary-muted uppercase mb-2 font-bold">
            Recent Trades ({recentFills.length})
          </div>
          <div className="space-y-1 max-h-[200px] overflow-y-auto">
            {recentFills.slice(0, 10).map((fill) => {
              const pnlColor = fill.closedPnl > 0 ? 'text-bullish' : fill.closedPnl < 0 ? 'text-bearish' : 'text-primary-muted';
              const sideColor = fill.side === 'buy' ? 'text-bullish' : 'text-bearish';

              return (
                <div key={fill.tid} className="flex items-center justify-between p-1.5 bg-bg-primary rounded text-[9px]">
                  <div className="flex items-center gap-2">
                    <span className="text-primary font-bold">{fill.coin}</span>
                    <span className={sideColor}>{fill.side.toUpperCase()}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div>
                      <span className="text-primary-muted">Size: </span>
                      <span className="text-primary">{fill.size.toFixed(4)}</span>
                    </div>
                    <div>
                      <span className="text-primary-muted">Price: </span>
                      <span className="text-primary">${fill.price.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-primary-muted">P&L: </span>
                      <span className={pnlColor}>${fill.closedPnl.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

        {positions.length === 0 && orders.length === 0 && recentFills.length === 0 && (
          <div className="text-center py-4">
            <p className="text-primary-muted text-[10px]">No trading activity</p>
          </div>
        )}
      </div>

      {/* Right Column - Change History */}
      <div className="bg-bg-secondary p-2 rounded">
        <div className="text-[10px] text-primary-muted uppercase mb-2 font-bold">
          Change History ({changeHistory.length})
        </div>
        <div className="space-y-1 max-h-[500px] overflow-y-auto">
          {changeHistory.length > 0 ? (
            changeHistory.map((event, idx) => {
              const isPosition = event.type.startsWith('position_');
              const isOrder = event.type.startsWith('order_');
              const typeColor =
                event.type === 'position_opened' || event.type === 'order_placed' ? 'text-bullish' :
                event.type === 'position_closed' || event.type === 'order_cancelled' ? 'text-bearish' :
                'text-primary-muted';
              const sideColor = event.side === 'long' || event.side === 'buy' ? 'text-bullish' : 'text-bearish';

              return (
                <div key={idx} className="p-1.5 bg-bg-primary rounded text-[9px]">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-primary font-bold">{event.coin}</span>
                      <span className={sideColor}>{event.side.toUpperCase()}</span>
                      <span className={typeColor}>{formatChangeType(event.type)}</span>
                    </div>
                    <span className="text-primary-muted text-[8px]">{formatTimestamp(event.timestamp)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[8px]">
                    {event.size !== undefined && (
                      <div>
                        <span className="text-primary-muted">Size: </span>
                        <span className="text-primary">{event.size.toFixed(4)}</span>
                      </div>
                    )}
                    {event.price !== undefined && (
                      <div>
                        <span className="text-primary-muted">Price: </span>
                        <span className="text-primary">${event.price.toFixed(2)}</span>
                      </div>
                    )}
                    {event.pnl !== undefined && (
                      <div>
                        <span className="text-primary-muted">P&L: </span>
                        <span className={event.pnl > 0 ? 'text-bullish' : event.pnl < 0 ? 'text-bearish' : 'text-primary-muted'}>
                          ${event.pnl.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-4">
              <p className="text-primary-muted text-[10px]">No changes recorded yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
