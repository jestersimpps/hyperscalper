import MultiChartView from '@/components/multi-chart/MultiChartView';

interface MultiChartPageProps {
  params: Promise<{
    symbol: string;
  }>;
}

export default async function MultiChartPage({ params }: MultiChartPageProps) {
  const { symbol } = await params;

  return <MultiChartView coin={symbol} />;
}
