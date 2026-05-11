'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { useHyperliquidService } from '@/lib/hooks/use-hyperliquid-service';
import { useAddressFromUrl } from '@/lib/hooks/use-address-from-url';

const REFRESH_MS = 30_000;

function startOfTodayMs(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function formatUsd(value: number): string {
  const abs = Math.abs(value);
  const fixed = abs >= 1000 ? abs.toFixed(0) : abs.toFixed(2);
  const withCommas = fixed.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${value < 0 ? '-' : ''}$${withCommas}`;
}

function WalletStats() {
  const address = useAddressFromUrl();
  const service = useHyperliquidService(address || undefined);
  const [balance, setBalance] = useState<number | null>(null);
  const [netPnl, setNetPnl] = useState<number | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!service || !address) {
      setBalance(null);
      setNetPnl(null);
      return;
    }

    let cancelled = false;

    const refresh = async () => {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        const [accountBalance, fills] = await Promise.all([
          service.getAccountBalance(address).catch(() => null),
          service.getUserFillsByTime(startOfTodayMs(), Date.now(), address).catch(() => [] as Awaited<ReturnType<typeof service.getUserFillsByTime>>),
        ]);

        if (cancelled) return;

        if (accountBalance) {
          setBalance(parseFloat(accountBalance.accountValue));
        }

        const net = fills.reduce((sum, f) => sum + f.closedPnl - f.fee, 0);
        setNetPnl(net);
      } finally {
        inFlight.current = false;
      }
    };

    refresh();
    const id = setInterval(refresh, REFRESH_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [service, address]);

  if (!address) return null;

  const pnlClass =
    netPnl === null
      ? 'text-primary-muted'
      : netPnl > 0
        ? 'text-bullish'
        : netPnl < 0
          ? 'text-bearish'
          : 'text-primary-muted';

  const pnlPrefix = netPnl !== null && netPnl > 0 ? '+' : '';

  return (
    <div className="hidden lg:flex items-center gap-3 px-2 py-1 text-[10px] font-mono border-r-2 border-frame mr-1">
      <div className="flex items-center gap-1">
        <span className="text-primary-muted">BAL</span>
        <span className="text-primary font-bold">
          {balance === null ? '—' : formatUsd(balance)}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-primary-muted">PNL TODAY</span>
        <span className={`${pnlClass} font-bold`}>
          {netPnl === null ? '—' : `${pnlPrefix}${formatUsd(netPnl)}`}
        </span>
      </div>
    </div>
  );
}

export default memo(WalletStats);
