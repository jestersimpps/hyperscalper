import MultiChartView from '@/components/multi-chart/MultiChartView';
import type { Metadata } from 'next';

interface MultiChartPageProps {
  params: Promise<{
    address: string;
    symbol: string;
  }>;
}

export async function generateMetadata({ params }: MultiChartPageProps): Promise<Metadata> {
  const { symbol } = await params;
  const upperSymbol = symbol.toUpperCase();

  return {
    title: `${upperSymbol} Multi-Chart | Hyperscalper`,
    description: `${upperSymbol} multi-timeframe analysis with synchronized charts`,
  };
}

export default async function MultiChartPage({ params }: MultiChartPageProps) {
  const { address, symbol } = await params;

  return <MultiChartView coin={symbol} />;
}
