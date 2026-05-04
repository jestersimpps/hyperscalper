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
const RIGHT_OFFSET_PX = 80;

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

    // Native tick from book gaps (used as a floor on bucket size).
    const sample = [...book.bids.slice(0, 8), ...book.asks.slice(0, 8)]
      .map((l) => l.price)
      .sort((a, b) => a - b);
    let nativeTick = Infinity;
    for (let i = 1; i < sample.length; i++) {
      const gap = sample[i] - sample[i - 1];
      if (gap > 0 && gap < nativeTick) nativeTick = gap;
    }
    if (!Number.isFinite(nativeTick) || nativeTick <= 0) nativeTick = 0.01;

    // Match bucket size to the chart's price-per-pixel so each row aligns
    // with a price-scale gridline. Gridlines on lightweight-charts sit roughly
    // every 50px; we target ROW_HEIGHT_PX * 4 ≈ 48px per bucket.
    const refMid = (book.bestBid != null && book.bestAsk != null)
      ? (book.bestBid + book.bestAsk) / 2
      : (book.bids[0]?.price ?? book.asks[0]?.price ?? 0);
    const probeOffset = nativeTick * 50;
    const yMid = priceToY(flipPrice(refMid));
    const yProbe = priceToY(flipPrice(refMid + probeOffset));
    let pricePerPx = nativeTick / 12;
    if (yMid != null && yProbe != null && Math.abs(yProbe - yMid) > 0.5) {
      pricePerPx = Math.abs(probeOffset / (yProbe - yMid));
    }
    const targetSpan = pricePerPx * (ROW_HEIGHT_PX * 4);
    const rawStep = Math.max(targetSpan, nativeTick);
    const exp = Math.floor(Math.log10(rawStep));
    const base = rawStep / Math.pow(10, exp);
    const niceBase = base >= 5 ? 5 : base >= 2 ? 2 : 1;
    const bucketStep = niceBase * Math.pow(10, exp);
    const bucketDecimals = Math.max(0, -exp + (niceBase === 1 ? 0 : 0));

    const aggregate = (
      levels: typeof book.bids,
      side: 'bid' | 'ask',
    ): { price: number; size: number; total: number }[] => {
      const buckets = new Map<number, number>();
      for (const lvl of levels) {
        const bucketed = side === 'bid'
          ? Math.floor(lvl.price / bucketStep) * bucketStep
          : Math.ceil(lvl.price / bucketStep) * bucketStep;
        const key = Number(bucketed.toFixed(bucketDecimals + 2));
        buckets.set(key, (buckets.get(key) ?? 0) + lvl.size);
      }
      const sorted = Array.from(buckets.entries()).sort(([a], [b]) =>
        side === 'bid' ? b - a : a - b,
      );
      let running = 0;
      return sorted.map(([price, size]) => {
        running += size;
        return { price, size, total: running };
      });
    };

    const aggregatedBids = aggregate(book.bids, 'bid');
    const aggregatedAsks = aggregate(book.asks, 'ask');

    let maxSize = 0;
    for (const lvl of aggregatedBids) if (lvl.size > maxSize) maxSize = lvl.size;
    for (const lvl of aggregatedAsks) if (lvl.size > maxSize) maxSize = lvl.size;
    if (maxSize <= 0) maxSize = 1;

    const out: RenderedRow[] = [];

    for (const lvl of aggregatedBids) {
      const y = priceToY(flipPrice(lvl.price));
      if (y == null || !Number.isFinite(y)) continue;
      out.push({
        key: `bid-${lvl.price}`,
        side: 'bid',
        price: lvl.price,
        size: lvl.size,
        total: lvl.total,
        y,
        widthPct: Math.min(lvl.size / maxSize, 1),
      });
    }
    for (const lvl of aggregatedAsks) {
      const y = priceToY(flipPrice(lvl.price));
      if (y == null || !Number.isFinite(y)) continue;
      out.push({
        key: `ask-${lvl.price}`,
        side: 'ask',
        price: lvl.price,
        size: lvl.size,
        total: lvl.total,
        y,
        widthPct: Math.min(lvl.size / maxSize, 1),
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
