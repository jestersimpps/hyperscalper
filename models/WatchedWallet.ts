import type { AssetPosition, FrontendOrder } from '@nktkas/hyperliquid';
import type { UserFill } from '@/types';
import type { AccountBalance } from '@/lib/services/types';

export interface WatchedWallet {
  address: string;
  nickname?: string;
  addedAt: number;
  lastFetched?: number;
  isLoading?: boolean;
  isFollowed?: boolean;
}

export interface WalletData {
  address: string;
  positions: AssetPosition[];
  orders: FrontendOrder[];
  recentFills: UserFill[];
  balance?: AccountBalance;
  statistics?: WalletStatistics;
  lastFetched: number;
}

export interface WalletStatistics {
  totalPnl: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  avgWin: number;
  avgLoss: number;
  totalFees: number;
  unrealizedPnl: number;
}
