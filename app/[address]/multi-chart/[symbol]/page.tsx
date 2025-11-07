import MultiChartView from '@/components/multi-chart/MultiChartView';

interface MultiChartPageProps {
  params: Promise<{
    address: string;
    symbol: string;
  }>;
}

export default async function MultiChartPage({ params }: MultiChartPageProps) {
  const { address, symbol } = await params;

  return <MultiChartView coin={symbol} />;
}
