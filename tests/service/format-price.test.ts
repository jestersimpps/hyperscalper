import { describe, expect, it } from 'vitest';
import { metadataCache, type SymbolMetadata } from '@/lib/services/metadata-cache.service';

const meta = (sizeDecimals: number): SymbolMetadata => ({
  coinIndex: 0,
  tickSize: 0,
  sizeDecimals,
  timestamp: 0,
});

describe('MetadataCache.formatPrice', () => {
  it('caps at 5 significant figures for sub-dollar prices', () => {
    expect(metadataCache.formatPrice(0.123456789, meta(0))).toBe('0.12346');
    expect(metadataCache.formatPrice(0.0001234567, meta(2))).toBe('0.0001');
  });

  it('caps decimals at MAX_DECIMALS - szDecimals', () => {
    // szDecimals = 4 → max 2 decimals; sig-fig rule would allow 4 here
    expect(metadataCache.formatPrice(1.23456, meta(4))).toBe('1.23');
  });

  it('rounds to 5 sig figs for the LINK regression case (~$15)', () => {
    // szDecimals 1 → max 5 decimals; sig-fig rule wins → 3 decimals
    expect(metadataCache.formatPrice(15.2345678, meta(1))).toBe('15.235');
    expect(metadataCache.formatPrice(15.2354, meta(1))).toBe('15.235');
  });

  it('drops decimals when integer part already eats the sig-fig budget', () => {
    expect(metadataCache.formatPrice(12345.6789, meta(0))).toBe('12346');
    expect(metadataCache.formatPrice(123456, meta(0))).toBe('123456');
  });

  it('handles BTC-like high prices', () => {
    expect(metadataCache.formatPrice(67234.789, meta(5))).toBe('67235');
  });

  it('handles ETH-like prices', () => {
    expect(metadataCache.formatPrice(3456.789, meta(4))).toBe('3456.8');
  });

  it('returns "0" for non-positive prices', () => {
    expect(metadataCache.formatPrice(0, meta(2))).toBe('0');
    expect(metadataCache.formatPrice(-1, meta(2))).toBe('0');
  });

  it('produces strings parseable back to a tick-aligned number', () => {
    const m = meta(1);
    const out = metadataCache.formatPrice(15.2345678, m);
    const back = parseFloat(out);
    // 5 sig figs at this magnitude → 3 decimals → multiple of 0.001
    expect(Math.round(back * 1000)).toBeCloseTo(back * 1000, 6);
  });
});
