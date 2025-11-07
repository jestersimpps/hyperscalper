import ChartPopupView from '@/components/chart-popup/ChartPopupView';

interface ChartPopupPageProps {
  params: Promise<{
    symbol: string;
  }>;
}

export default async function ChartPopupPage({ params }: ChartPopupPageProps) {
  const { symbol } = await params;

  return <ChartPopupView coin={symbol} />;
}
