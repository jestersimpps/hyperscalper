'use client';

import { useEffect, useMemo, useReducer, useRef } from 'react';
import { useOrderbookStore } from '@/stores/useOrderbookStore';
import { useSymbolMetaStore } from '@/stores/useSymbolMetaStore';
import { getThemeColors } from '@/lib/theme-utils';
import { formatSize } from '@/lib/format-utils';

interface OrderbookOverlayProps {
  coin: string;
  priceToY: ((price: number) => number | null) | null;
  chartReady: boolean;
  enabled: boolean;
  inverted: boolean;
  invertReference: number | null;
}

interface RenderedRow {
  key: string;
  side: 'bid' | 'ask';
  price: number;
  size: number;
  total: number;
  y: number;
  widthPct: number;
}

const BAR_MAX_WIDTH_PX = 110;
const ROW_HEIGHT_PX = 12;
const RIGHT_OFFSET_PX = 96;

export default function OrderbookOverlay({
  coin,
  priceToY,
  chartReady,
  enabled,
  inverted,
  invertReference,
}: OrderbookOverlayProps) {
  const book = useOrderbookStore((state) => state.books[coin]);
  const sizeDecimals = useSymbolMetaStore(
    (state) => state.metadata[coin]?.szDecimals ?? 4,
  );
  const [resizeTick, bumpResize] = useReducer((n: number) => n + 1, 0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || !chartReady) return;

    const onResize = () => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        bumpResize();
      });
    };

    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [enabled, chartReady]);

  const rows = useMemo<RenderedRow[]>(() => {
    if (!enabled || !chartReady || !book || !priceToY) return [];

    const flipPrice = (price: number) =>
      inverted && invertReference != null && invertReference > 0
        ? 2 * invertReference - price
        : price;

    const maxBidTotal = book.bids[book.bids.length - 1]?.total ?? 0;
    const maxAskTotal = book.asks[book.asks.length - 1]?.total ?? 0;
    const maxTotal = Math.max(maxBidTotal, maxAskTotal, 1);

    const out: RenderedRow[] = [];

    for (const lvl of book.bids) {
      const y = priceToY(flipPrice(lvl.price));
      if (y == null || !Number.isFinite(y)) continue;
      out.push({
        key: `bid-${lvl.price}`,
        side: 'bid',
        price: lvl.price,
        size: lvl.size,
        total: lvl.total,
        y,
        widthPct: Math.min(lvl.total / maxTotal, 1),
      });
    }
    for (const lvl of book.asks) {
      const y = priceToY(flipPrice(lvl.price));
      if (y == null || !Number.isFinite(y)) continue;
      out.push({
        key: `ask-${lvl.price}`,
        side: 'ask',
        price: lvl.price,
        size: lvl.size,
        total: lvl.total,
        y,
        widthPct: Math.min(lvl.total / maxTotal, 1),
      });
    }

    return out;
    // resizeTick re-runs the memo after window resizes (priceToY captures a ref)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book, enabled, chartReady, priceToY, inverted, invertReference, resizeTick]);

  if (!enabled || !chartReady || rows.length === 0) return null;

  const colors = getThemeColors();
  const bidColor = inverted ? colors.statusBearish : colors.statusBullish;
  const askColor = inverted ? colors.statusBullish : colors.statusBearish;
  const bidBarBg = `${bidColor}66`;
  const askBarBg = `${askColor}66`;

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 5 }}
    >
      {rows.map((row) => {
        const isBid = row.side === 'bid';
        const color = isBid ? bidColor : askColor;
        const barBg = isBid ? bidBarBg : askBarBg;
        const barWidth = Math.max(2, BAR_MAX_WIDTH_PX * row.widthPct);

        return (
          <div
            key={row.key}
            className="absolute pointer-events-none flex items-center justify-end"
            style={{
              right: `${RIGHT_OFFSET_PX}px`,
              top: `${row.y - ROW_HEIGHT_PX / 2}px`,
              height: `${ROW_HEIGHT_PX}px`,
              width: `${barWidth}px`,
              background: barBg,
              borderRight: `1px solid ${color}`,
            }}
            title={`${row.price} × ${row.size}`}
          >
            <span
              className="text-[9px] font-mono px-1"
              style={{ color, textShadow: '0 0 2px rgba(0,0,0,0.85)' }}
            >
              {formatSize(row.size, sizeDecimals)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
