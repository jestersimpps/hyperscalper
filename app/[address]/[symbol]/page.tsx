import SymbolView from '@/components/symbol/SymbolView';
import type { Metadata } from 'next';

interface SymbolPageProps {
  params: Promise<{ address: string; symbol: string }>;
}

export async function generateMetadata({ params }: SymbolPageProps): Promise<Metadata> {
  const { symbol } = await params;
  const upperSymbol = symbol.toUpperCase();

  return {
    title: `${upperSymbol} Trading | Hyperscalper`,
    description: `Real-time ${upperSymbol} chart with advanced scalping tools on Hyperliquid DEX`,
  };
}

export default async function SymbolPage({ params }: SymbolPageProps) {
  const { address, symbol } = await params;
  const upperSymbol = symbol.toUpperCase();

  return <SymbolView coin={upperSymbol} />;
}
