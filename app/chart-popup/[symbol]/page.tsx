import { use } from 'react';
import ChartPopupView from '@/components/chart-popup/ChartPopupView';

interface ChartPopupPageProps {
  params: Promise<{
    symbol: string;
  }>;
}

export function generateStaticParams() {
  const topSymbols = [
    'BTC', 'ETH', 'SOL', 'ARB', 'AVAX', 'BNB', 'DOGE', 'MATIC',
    'OP', 'LINK', 'UNI', 'LTC', 'XRP', 'ADA', 'DOT', 'ATOM',
    'APT', 'SUI', 'SEI', 'TIA', 'INJ', 'ORDI', 'WIF', 'BONK',
    'PEPE', 'SHIB', 'FLOKI', 'NEAR', 'FTM', 'GRT'
  ];

  return topSymbols.map((symbol) => ({
    symbol,
  }));
}

export default function ChartPopupPage({ params }: ChartPopupPageProps) {
  const { symbol } = use(params);

  return <ChartPopupView coin={symbol} />;
}
