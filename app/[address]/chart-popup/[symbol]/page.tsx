import ChartPopupView from '@/components/chart-popup/ChartPopupView';

interface ChartPopupPageProps {
  params: Promise<{
    address: string;
    symbol: string;
  }>;
}

export default async function ChartPopupPage({ params }: ChartPopupPageProps) {
  const { address, symbol } = await params;

  return <ChartPopupView coin={symbol} address={address} />;
}
