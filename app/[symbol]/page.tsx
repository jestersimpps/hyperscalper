import { use } from 'react';
import SymbolView from '@/components/symbol/SymbolView';

interface SymbolPageProps {
  params: Promise<{ symbol: string }>;
}

export default function SymbolPage({ params }: SymbolPageProps) {
  const { symbol } = use(params);
  const upperSymbol = symbol.toUpperCase();

  return <SymbolView key={upperSymbol} coin={upperSymbol} />;
}
