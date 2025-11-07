'use client';

import { memo } from 'react';
import { useAddressFromUrl } from '@/lib/hooks/use-address-from-url';
import { useIsOwnWallet } from '@/lib/hooks/use-is-own-wallet';

function WalletIndicator() {
  const addressFromUrl = useAddressFromUrl();
  const isOwnWallet = useIsOwnWallet();

  if (!addressFromUrl) {
    return null;
  }

  const shortAddress = `${addressFromUrl.slice(0, 6)}...${addressFromUrl.slice(-4)}`;

  return (
    <div className="flex items-center gap-2 px-2 py-1 text-[10px] font-mono">
      {isOwnWallet ? (
        <div className="flex items-center gap-1">
          <span className="text-bullish">●</span>
          <span className="text-primary font-bold">YOUR WALLET</span>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <span className="text-primary-muted">●</span>
          <span className="text-primary-muted">VIEWING:</span>
          <span className="text-primary">{shortAddress}</span>
        </div>
      )}
    </div>
  );
}

export default memo(WalletIndicator);
