import SymbolView from '@/components/symbol/SymbolView';

interface SymbolPageProps {
  params: Promise<{ symbol: string }>;
}

export default async function SymbolPage({ params }: SymbolPageProps) {
  const { symbol } = await params;
  const upperSymbol = symbol.toUpperCase();

  return <SymbolView key={upperSymbol} coin={upperSymbol} />;
}
