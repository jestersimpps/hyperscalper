import { use } from 'react';
import MultiChartView from '@/components/multi-chart/MultiChartView';

interface MultiChartPageProps {
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

export default function MultiChartPage({ params }: MultiChartPageProps) {
  const { symbol } = use(params);

  return <MultiChartView coin={symbol} />;
}
