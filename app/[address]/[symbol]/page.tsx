import SymbolView from '@/components/symbol/SymbolView';

interface SymbolPageProps {
  params: Promise<{ address: string; symbol: string }>;
}

export default async function SymbolPage({ params }: SymbolPageProps) {
  const { address, symbol } = await params;
  const upperSymbol = symbol.toUpperCase();

  return <SymbolView key={`${address}-${upperSymbol}`} coin={upperSymbol} />;
}
