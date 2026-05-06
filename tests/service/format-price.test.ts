import { describe, it, expect } from 'vitest';
import { metadataCache, type SymbolMetadata } from '@/lib/services/metadata-cache.service';

const meta = (sizeDecimals: number): SymbolMetadata => ({
  coinIndex: 0,
  sizeDecimals,
  timestamp: 0,
});

describe('formatPrice — HL canonical sig-fig + decimal rule', () => {
  describe('high-priced perps (sig-fig rule dominates)', () => {
    it('BTC ($81,394.5) → integer (no decimals — 5 sig figs of an int already)', () => {
      // szDecimals 5 → maxDecimals 1; 5 sig figs of 81394 → 0 decimals.
      // min(1, 0) = 0 → "81395"
      expect(metadataCache.formatPrice(81394.5, meta(5))).toBe('81395');
    });

    it('ETH ($3,500.55) → 1 decimal (sig-fig rule)', () => {
      // szDecimals 4 → maxDecimals 2; 5 sig figs of 3500 → 1 decimal.
      expect(metadataCache.formatPrice(3500.55, meta(4))).toBe('3500.6');
    });

    it('SOL ($150.123) → 2 decimals', () => {
      // szDecimals 3 → maxDecimals 3; 5 sig figs of 150 → 2 decimals.
      expect(metadataCache.formatPrice(150.123, meta(3))).toBe('150.12');
    });
  });

  describe('the previously-broken low-priced alts (decimal rule dominates)', () => {
    // Before: app calculated tick from book gap → coarse → formatted to 0.001
    // After:  HL canonical → szDecimals 1 → maxDecimals 5
    it('FTT (0.32397, szDecimals=1) preserves all 5 decimals — was rounding to 0.324', () => {
      expect(metadataCache.formatPrice(0.32397, meta(1))).toBe('0.32397');
    });

    it('kPEPE (0.004157, szDecimals=0) preserves 6 decimals — was rounding to 0.00416', () => {
      // szDecimals 0 → maxDecimals 6; 5 sig figs of 0.00 → 8 decimals.
      // min(6, 8) = 6 → "0.004157"
      expect(metadataCache.formatPrice(0.004157, meta(0))).toBe('0.004157');
    });

    it('SHIB-style 0.00006425 (szDecimals=0) keeps 6 decimals', () => {
      expect(metadataCache.formatPrice(0.00006425, meta(0))).toBe('0.000064');
    });
  });

  describe('rounding behavior', () => {
    it('rounds half-up (typical case)', () => {
      // 150.125 → at 2 decimals → 150.13 (or 150.12 with banker's). Document
      // current behavior: Math.round uses half-away-from-zero → 150.13.
      expect(metadataCache.formatPrice(150.125, meta(3))).toBe('150.13');
    });

    it('handles a price just under a sig-fig boundary', () => {
      // 9.9999 with szDecimals=2 → maxDecimals=4; 5 sig figs of 9 → 4 decimals.
      // min = 4 → "9.9999"
      expect(metadataCache.formatPrice(9.9999, meta(2))).toBe('9.9999');
    });

    it('returns "0" for non-positive prices instead of NaN', () => {
      expect(metadataCache.formatPrice(0, meta(3))).toBe('0');
      expect(metadataCache.formatPrice(-1, meta(3))).toBe('0');
    });
  });
});
