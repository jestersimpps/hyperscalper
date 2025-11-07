import { use } from 'react';
import SymbolView from '@/components/symbol/SymbolView';

interface SymbolPageProps {
  params: Promise<{ symbol: string }>;
}

export function generateStaticParams() {
  const topSymbols = [
    'BTC', 'ETH', 'SOL', 'ARB', 'AVAX', 'BNB', 'DOGE', 'MATIC',
    'OP', 'LINK', 'UNI', 'LTC', 'XRP', 'ADA', 'DOT', 'ATOM',
    'APT', 'SUI', 'SEI', 'TIA', 'INJ', 'ORDI', 'WIF', 'BONK',
    'PEPE', 'SHIB', 'FLOKI', 'NEAR', 'FTM', 'GRT'
  ];

  return topSymbols.map((symbol) => ({
    symbol,
  }));
}

export default function SymbolPage({ params }: SymbolPageProps) {
  const { symbol } = use(params);
  const upperSymbol = symbol.toUpperCase();

  return <SymbolView key={upperSymbol} coin={upperSymbol} />;
}
