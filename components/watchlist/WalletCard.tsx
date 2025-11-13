'use client';

import { useState } from 'react';
import type { WatchedWallet, WalletData } from '@/models/WatchedWallet';
import WalletDetailPanel from './WalletDetailPanel';

interface WalletCardProps {
  wallet: WatchedWallet;
  data?: WalletData;
  isExpanded: boolean;
  onExpand: () => void;
  onRemove: () => void;
  onUpdateNickname: (address: string, nickname: string) => void;
  onToggleFollow: (address: string) => void;
  onRefresh: (address: string) => void;
}

export default function WalletCard({
  wallet,
  data,
  isExpanded,
  onExpand,
  onRemove,
  onUpdateNickname,
  onToggleFollow,
  onRefresh
}: WalletCardProps) {
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [nicknameInput, setNicknameInput] = useState(wallet.nickname || '');

  const handleSaveNickname = () => {
    onUpdateNickname(wallet.address, nicknameInput);
    setIsEditingNickname(false);
  };

  const handleCancelEdit = () => {
    setNicknameInput(wallet.nickname || '');
    setIsEditingNickname(false);
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const totalPnl = data?.statistics ? data.statistics.totalPnl + data.statistics.unrealizedPnl : 0;
  const positionCount = data?.positions?.length || 0;
  const orderCount = data?.orders?.length || 0;
  const winRate = data?.statistics?.winRate || 0;

  const pnlColor = totalPnl > 0 ? 'text-bullish' : totalPnl < 0 ? 'text-bearish' : 'text-primary-muted';

  return (
    <div className="terminal-border">
      <div className="p-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 flex-1">
            {isEditingNickname ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={nicknameInput}
                  onChange={(e) => setNicknameInput(e.target.value)}
                  className="bg-bg-secondary text-primary text-[10px] px-2 py-1 border border-frame rounded focus:border-primary focus:outline-none"
                  placeholder="Enter nickname"
                  autoFocus
                />
                <button
                  onClick={handleSaveNickname}
                  className="px-2 py-1 text-[9px] bg-primary/10 hover:bg-primary/20 text-primary border border-primary rounded"
                >
                  ✓
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="px-2 py-1 text-[9px] bg-bg-secondary hover:bg-bg-tertiary text-primary-muted border border-frame rounded"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div
                className="flex items-center gap-1 cursor-pointer hover:text-primary group"
                onClick={() => setIsEditingNickname(true)}
              >
                <span className="text-primary text-[11px] font-bold">
                  {wallet.nickname || formatAddress(wallet.address)}
                </span>
                <span className="text-[9px] text-primary-muted opacity-0 group-hover:opacity-100 transition-opacity">
                  ✎
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onRefresh(wallet.address)}
              disabled={wallet.isLoading}
              className="px-2 py-0.5 text-[9px] border rounded transition-colors text-primary-muted border-frame hover:text-primary hover:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
              title="Refresh wallet data"
            >
              ↻
            </button>
            <button
              onClick={() => onToggleFollow(wallet.address)}
              className={`px-2 py-0.5 text-[9px] border rounded transition-colors ${
                wallet.isFollowed
                  ? 'text-primary border-primary hover:border-primary-bright bg-primary/10'
                  : 'text-primary-muted border-frame hover:text-primary hover:border-primary'
              }`}
              title={wallet.isFollowed ? 'Unfollow (disable notifications)' : 'Follow (enable notifications)'}
            >
              {wallet.isFollowed ? '🔔 FOLLOWING' : '🔕 FOLLOW'}
            </button>
            <button
              onClick={onRemove}
              className="px-2 py-0.5 text-[9px] text-bearish hover:text-bearish-bright border border-bearish hover:border-bearish-bright rounded transition-colors"
              title="Remove from watchlist"
            >
              REMOVE
            </button>
          </div>
        </div>

        <div className="text-[9px] text-primary-muted mb-2">
          {wallet.nickname && <div>{formatAddress(wallet.address)}</div>}
        </div>

        {wallet.isLoading ? (
          <div className="text-center py-4">
            <span className="text-primary-muted text-[10px]">Loading...</span>
          </div>
        ) : data ? (
          <>
            <div className="grid grid-cols-4 gap-2 mb-2">
              <div className="bg-bg-secondary p-2 rounded">
                <div className="text-[9px] text-primary-muted uppercase">Total P&L</div>
                <div className={`text-[11px] font-bold ${pnlColor}`}>
                  ${totalPnl.toFixed(2)}
                </div>
              </div>

              <div className="bg-bg-secondary p-2 rounded">
                <div className="text-[9px] text-primary-muted uppercase">Win Rate</div>
                <div className="text-[11px] font-bold text-primary">
                  {winRate.toFixed(1)}%
                </div>
              </div>

              <div className="bg-bg-secondary p-2 rounded">
                <div className="text-[9px] text-primary-muted uppercase">Positions</div>
                <div className="text-[11px] font-bold text-primary">
                  {positionCount}
                </div>
              </div>

              <div className="bg-bg-secondary p-2 rounded">
                <div className="text-[9px] text-primary-muted uppercase">Orders</div>
                <div className="text-[11px] font-bold text-primary">
                  {orderCount}
                </div>
              </div>
            </div>

            <button
              onClick={onExpand}
              className="w-full px-2 py-1 text-[9px] font-mono uppercase tracking-wider bg-bg-secondary hover:bg-primary/10 text-primary-muted hover:text-primary border border-frame hover:border-primary rounded cursor-pointer transition-all"
            >
              {isExpanded ? '▲ COLLAPSE' : '▼ VIEW DETAILS'}
            </button>

            {isExpanded && data && (
              <div className="mt-2">
                <WalletDetailPanel data={data} />
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-4">
            <span className="text-primary-muted text-[10px]">No data available</span>
          </div>
        )}

        {data?.lastFetched && (
          <div className="text-[8px] text-primary-muted text-right mt-2">
            Updated: {new Date(data.lastFetched).toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
}
