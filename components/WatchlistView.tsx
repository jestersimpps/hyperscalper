'use client';

import { useCallback, useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useWatchlistStore } from '@/stores/useWatchlistStore';
import { useTradingStore } from '@/stores/useTradingStore';
import WalletCard from '@/components/watchlist/WalletCard';
import AddWalletModal from '@/components/watchlist/AddWalletModal';

export default function WatchlistView() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { watchedWallets, walletData, isInitialized, expandedWallet } = useWatchlistStore(
    useShallow((state) => ({
      watchedWallets: state.watchedWallets,
      walletData: state.walletData,
      isInitialized: state.isInitialized,
      expandedWallet: state.expandedWallet,
    }))
  );

  const {
    initialize,
    setService,
    setExpandedWallet,
    startPolling,
    stopPolling,
    fetchWalletData,
    removeWallet,
    updateNickname,
    toggleFollow,
  } = useWatchlistStore(
    useShallow((state) => ({
      initialize: state.initialize,
      setService: state.setService,
      setExpandedWallet: state.setExpandedWallet,
      startPolling: state.startPolling,
      stopPolling: state.stopPolling,
      fetchWalletData: state.fetchWalletData,
      removeWallet: state.removeWallet,
      updateNickname: state.updateNickname,
      toggleFollow: state.toggleFollow,
    }))
  );

  const service = useTradingStore((state) => state.service);

  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, [isInitialized, initialize]);

  useEffect(() => {
    if (isInitialized) {
      const stuckLoadingWallets = watchedWallets.filter(w => w.isLoading);
      if (stuckLoadingWallets.length > 0) {
        console.warn('[WatchlistView] Clearing stuck loading states for wallets:',
          stuckLoadingWallets.map(w => w.address));
        stuckLoadingWallets.forEach(wallet => {
          useWatchlistStore.setState(state => ({
            watchedWallets: state.watchedWallets.map(w =>
              w.address === wallet.address ? { ...w, isLoading: false } : w
            )
          }));
        });
      }
    }
  }, [isInitialized, watchedWallets]);

  useEffect(() => {
    if (service) {
      setService(service);
    }
  }, [service, setService]);

  useEffect(() => {
    if (isInitialized && service) {
      startPolling();
      return () => {
        stopPolling();
      };
    }
  }, [isInitialized, service, startPolling, stopPolling]);

  const handleExpandWallet = useCallback(async (address: string) => {
    const normalized = address.toLowerCase();
    const current = useWatchlistStore.getState().expandedWallet;
    const next = current === normalized ? null : normalized;
    setExpandedWallet(next);
    if (next) {
      await fetchWalletData(next);
    }
  }, [setExpandedWallet, fetchWalletData]);

  const handleRemoveWallet = useCallback((address: string) => {
    if (confirm(`Remove wallet ${address} from watchlist?`)) {
      removeWallet(address);
      const current = useWatchlistStore.getState().expandedWallet;
      if (current === address.toLowerCase()) {
        setExpandedWallet(null);
      }
    }
  }, [removeWallet, setExpandedWallet]);

  const handleUpdateNickname = useCallback((address: string, nickname: string) => {
    updateNickname(address, nickname);
  }, [updateNickname]);

  const handleToggleFollow = useCallback((address: string) => {
    toggleFollow(address);
  }, [toggleFollow]);

  const handleRefreshAll = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all(watchedWallets.map(w => fetchWalletData(w.address)));
    } finally {
      setIsRefreshing(false);
    }
  }, [watchedWallets, fetchWalletData]);

  const handleRefreshWallet = useCallback(async (address: string) => {
    await fetchWalletData(address);
  }, [fetchWalletData]);

  return (
    <div className="h-full flex flex-col bg-bg-primary">
      <div className="flex flex-col h-full w-full p-2 gap-2 overflow-y-auto">
        <div className="terminal-border p-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-primary text-sm font-bold tracking-wider">WALLET WATCHLIST</h2>
              <p className="text-primary-muted text-[10px] mt-1">
                Track positions, orders, and performance of other traders
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleRefreshAll}
                disabled={isRefreshing || watchedWallets.length === 0}
                className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider bg-primary/10 hover:bg-primary/20 active:bg-primary/30 active:scale-95 text-primary border border-primary rounded cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary/10"
              >
                {isRefreshing ? '↻ REFRESHING...' : '↻ REFRESH'}
              </button>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider bg-primary/10 hover:bg-primary/20 active:bg-primary/30 active:scale-95 text-primary border border-primary rounded cursor-pointer transition-all"
              >
                + ADD WALLET
              </button>
            </div>
          </div>

          {watchedWallets.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-primary-muted text-sm mb-2">No wallets in watchlist</p>
              <p className="text-primary-muted text-[10px]">
                Click "ADD WALLET" to start tracking other traders
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {watchedWallets.map((wallet) => (
                <WalletCard
                  key={wallet.address}
                  wallet={wallet}
                  data={walletData.get(wallet.address)}
                  isExpanded={expandedWallet === wallet.address}
                  onExpand={handleExpandWallet}
                  onRemove={handleRemoveWallet}
                  onUpdateNickname={handleUpdateNickname}
                  onToggleFollow={handleToggleFollow}
                  onRefresh={handleRefreshWallet}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {isAddModalOpen && (
        <AddWalletModal onClose={() => setIsAddModalOpen(false)} />
      )}
    </div>
  );
}
