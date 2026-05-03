export const DEMO_ADDRESS = '0xb83de012dba672c76a7dbbbf3e459cb59d7d6e36';

export const STATIC_SYMBOLS: ReadonlyArray<string> = [
  'BTC', 'ETH', 'SOL', 'AVAX', 'BNB', 'MATIC', 'DOGE', 'XRP', 'DOT', 'ADA',
  'LINK', 'UNI', 'ATOM', 'LTC', 'NEAR', 'OP', 'ARB', 'APT', 'INJ', 'TIA',
  'SUI', 'SEI', 'ORDI', 'PEPE', 'SHIB', 'BONK', 'WIF', 'FLOKI', 'GRT', 'FTM',
];

export function symbolStaticParams(): Array<{ address: string; symbol: string }> {
  return STATIC_SYMBOLS.flatMap((symbol) => [
    { address: DEMO_ADDRESS, symbol: symbol.toLowerCase() },
    { address: DEMO_ADDRESS, symbol },
  ]);
}
