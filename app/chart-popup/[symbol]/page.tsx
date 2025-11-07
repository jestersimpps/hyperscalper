import { use } from 'react';
import ChartPopupView from '@/components/chart-popup/ChartPopupView';

interface ChartPopupPageProps {
  params: Promise<{
    symbol: string;
  }>;
}

export default function ChartPopupPage({ params }: ChartPopupPageProps) {
  const { symbol } = use(params);

  return <ChartPopupView coin={symbol} />;
}
