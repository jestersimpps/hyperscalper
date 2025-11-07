import { use } from 'react';
import MultiChartView from '@/components/multi-chart/MultiChartView';

interface MultiChartPageProps {
  params: Promise<{
    symbol: string;
  }>;
}

export default function MultiChartPage({ params }: MultiChartPageProps) {
  const { symbol } = use(params);

  return <MultiChartView coin={symbol} />;
}
