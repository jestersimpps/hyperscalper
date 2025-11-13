'use client';

import { useState } from 'react';
import { useWatchlistStore } from '@/stores/useWatchlistStore';

interface AddWalletModalProps {
  onClose: () => void;
}

export default function AddWalletModal({ onClose }: AddWalletModalProps) {
  const [address, setAddress] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');

  const addWallet = useWatchlistStore((state) => state.addWallet);
  const watchedWallets = useWatchlistStore((state) => state.watchedWallets);

  const validateAddress = (addr: string): boolean => {
    const trimmed = addr.trim().toLowerCase();

    if (!trimmed) {
      setError('Address is required');
      return false;
    }

    if (!trimmed.startsWith('0x')) {
      setError('Address must start with 0x');
      return false;
    }

    if (trimmed.length !== 42) {
      setError('Address must be 42 characters long');
      return false;
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
      setError('Invalid address format');
      return false;
    }

    if (watchedWallets.some(w => w.address === trimmed)) {
      setError('Wallet already in watchlist');
      return false;
    }

    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedAddress = address.trim().toLowerCase();

    if (validateAddress(trimmedAddress)) {
      addWallet(trimmedAddress, nickname.trim() || undefined);
      onClose();
    }
  };

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAddress(e.target.value);
    setError('');
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-bg-primary border-2 border-border-frame p-4 max-w-md w-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-primary text-sm font-bold tracking-wider">ADD WALLET TO WATCHLIST</h3>
          <button
            onClick={onClose}
            className="text-primary-muted hover:text-primary text-lg leading-none"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-primary text-[10px] font-mono uppercase mb-1">
              Wallet Address *
            </label>
            <input
              type="text"
              value={address}
              onChange={handleAddressChange}
              placeholder="0x..."
              className="w-full bg-bg-secondary text-primary text-[11px] px-3 py-2 border border-frame rounded focus:border-primary focus:outline-none font-mono"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-primary text-[10px] font-mono uppercase mb-1">
              Nickname (Optional)
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="e.g., Top Trader, Friend, etc."
              className="w-full bg-bg-secondary text-primary text-[11px] px-3 py-2 border border-frame rounded focus:border-primary focus:outline-none"
              maxLength={50}
            />
          </div>

          {error && (
            <div className="bg-bearish/10 border border-bearish px-3 py-2 rounded">
              <p className="text-bearish text-[10px]">{error}</p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              className="flex-1 px-3 py-2 text-[10px] font-mono uppercase tracking-wider bg-primary/10 hover:bg-primary/20 active:bg-primary/30 text-primary border border-primary rounded cursor-pointer transition-all"
            >
              ADD WALLET
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-3 py-2 text-[10px] font-mono uppercase tracking-wider bg-bg-secondary hover:bg-bg-tertiary text-primary-muted hover:text-primary border border-frame rounded cursor-pointer transition-all"
            >
              CANCEL
            </button>
          </div>
        </form>

        <div className="mt-4 pt-3 border-t border-frame">
          <p className="text-primary-muted text-[9px] leading-relaxed">
            Note: All wallet addresses on Hyperliquid are public. This feature tracks positions, orders, and trade history for any wallet address.
          </p>
        </div>
      </div>
    </div>
  );
}
