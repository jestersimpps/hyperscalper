import ChartPopupView from '@/components/chart-popup/ChartPopupView';
import type { Metadata } from 'next';
import { symbolStaticParams } from '@/lib/static-params';

interface ChartPopupPageProps {
  params: Promise<{
    address: string;
    symbol: string;
  }>;
}

export function generateStaticParams(): Array<{ address: string; symbol: string }> {
  return symbolStaticParams();
}

export async function generateMetadata({ params }: ChartPopupPageProps): Promise<Metadata> {
  const { symbol } = await params;
  const upperSymbol = symbol.toUpperCase();

  return {
    title: `${upperSymbol} Chart | Hyperscalper`,
    description: `${upperSymbol} chart popup window for multi-monitor trading setup`,
  };
}

export default async function ChartPopupPage({ params }: ChartPopupPageProps) {
  const { address, symbol } = await params;

  return <ChartPopupView coin={symbol} address={address} />;
}
