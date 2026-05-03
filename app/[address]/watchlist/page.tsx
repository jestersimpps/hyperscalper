import WatchlistView from '@/components/WatchlistView';
import type { Metadata } from 'next';
import { DEMO_ADDRESS } from '@/lib/static-params';

export const metadata: Metadata = {
  title: "Wallet Watchlist | Hyperscalper",
  description: "Track positions, orders, and performance of other traders by their wallet address",
};

export function generateStaticParams(): Array<{ address: string }> {
  return [{ address: DEMO_ADDRESS }];
}

export default function WatchlistPage() {
  return <WatchlistView />;
}
