import TodaysTradesView from '@/components/TodaysTradesView';
import type { Metadata } from 'next';
import { DEMO_ADDRESS } from '@/lib/static-params';

export const metadata: Metadata = {
  title: "Trade History | Hyperscalper",
  description: "View your complete trading history with performance analytics and detailed trade metrics",
};

export function generateStaticParams(): Array<{ address: string }> {
  return [{ address: DEMO_ADDRESS }];
}

export default function TradesPage() {
  return <TodaysTradesView />;
}
