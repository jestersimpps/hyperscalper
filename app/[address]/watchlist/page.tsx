import WatchlistView from '@/components/WatchlistView';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Wallet Watchlist | Hyperscalper",
  description: "Track positions, orders, and performance of other traders by their wallet address",
};

export default function WatchlistPage() {
  return <WatchlistView />;
}
