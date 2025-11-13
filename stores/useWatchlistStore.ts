import { create } from 'zustand';
import type { HyperliquidService } from '@/lib/services/hyperliquid.service';
import type { WatchedWallet, WalletData, WalletStatistics, WalletChangeEvent } from '@/models/WatchedWallet';
import { groupFillsByPosition } from '@/lib/trade-grouping-utils';
import {
  notifyNewPosition,
  notifyClosedPosition,
  notifyReducedPosition,
  notifyNewOrder,
  notifyRemovedOrder
} from '@/lib/wallet-notifications';

interface WatchlistStore {
  watchedWallets: WatchedWallet[];
  walletData: Map<string, WalletData>;
  service: HyperliquidService | null;
  pollingInterval: NodeJS.Timeout | null;
  isInitialized: boolean;

  setService: (service: HyperliquidService) => void;
  addWallet: (address: string, nickname?: string) => void;
  removeWallet: (address: string) => void;
  updateNickname: (address: string, nickname: string) => void;
  toggleFollow: (address: string) => void;
  fetchWalletData: (address: string) => Promise<void>;
  fetchAllWalletsData: () => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
  initialize: () => void;
  clearWalletData: (address: string) => void;
}

const STORAGE_KEY = 'hyperscalper_watchlist';
const SNAPSHOTS_STORAGE_KEY = 'hyperscalper_watchlist_snapshots';
const CHANGE_HISTORY_STORAGE_KEY = 'hyperscalper_watchlist_history';
const POLLING_INTERVAL = 5 * 60 * 1000;
const MAX_HISTORY_EVENTS = 50;

interface WalletSnapshot {
  address: string;
  positions: any[];
  orders: any[];
  lastFetched: number;
}

const loadWatchlistFromStorage = (): WatchedWallet[] => {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to load watchlist from storage:', error);
    return [];
  }
};

const saveWatchlistToStorage = (wallets: WatchedWallet[]) => {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(wallets));
  } catch (error) {
    console.error('Failed to save watchlist to storage:', error);
  }
};

const loadWalletSnapshotsFromStorage = (): Map<string, WalletSnapshot> => {
  if (typeof window === 'undefined') return new Map();

  try {
    const stored = localStorage.getItem(SNAPSHOTS_STORAGE_KEY);
    if (!stored) return new Map();

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return new Map();

    const snapshotsMap = new Map<string, WalletSnapshot>();
    parsed.forEach((snapshot: WalletSnapshot) => {
      snapshotsMap.set(snapshot.address, snapshot);
    });
    return snapshotsMap;
  } catch (error) {
    console.error('Failed to load wallet snapshots from storage:', error);
    return new Map();
  }
};

const saveWalletSnapshotsToStorage = (snapshots: Map<string, WalletSnapshot>) => {
  if (typeof window === 'undefined') return;

  try {
    const snapshotsArray = Array.from(snapshots.values());
    localStorage.setItem(SNAPSHOTS_STORAGE_KEY, JSON.stringify(snapshotsArray));
  } catch (error) {
    console.error('Failed to save wallet snapshots to storage:', error);
  }
};

const loadChangeHistoryFromStorage = (): Map<string, WalletChangeEvent[]> => {
  if (typeof window === 'undefined') return new Map();

  try {
    const stored = localStorage.getItem(CHANGE_HISTORY_STORAGE_KEY);
    if (!stored) return new Map();

    const parsed = JSON.parse(stored);
    if (typeof parsed !== 'object') return new Map();

    return new Map(Object.entries(parsed));
  } catch (error) {
    console.error('Failed to load change history from storage:', error);
    return new Map();
  }
};

const saveChangeHistoryToStorage = (history: Map<string, WalletChangeEvent[]>) => {
  if (typeof window === 'undefined') return;

  try {
    const historyObj = Object.fromEntries(history);
    localStorage.setItem(CHANGE_HISTORY_STORAGE_KEY, JSON.stringify(historyObj));
  } catch (error) {
    console.error('Failed to save change history to storage:', error);
  }
};

const addChangeEvent = (address: string, event: WalletChangeEvent): WalletChangeEvent[] => {
  const history = loadChangeHistoryFromStorage();
  const walletHistory = history.get(address) || [];

  const updatedHistory = [event, ...walletHistory].slice(0, MAX_HISTORY_EVENTS);
  history.set(address, updatedHistory);
  saveChangeHistoryToStorage(history);

  return updatedHistory;
};

const calculateStatistics = (fills: any[], positions: any[]): WalletStatistics => {
  const positionGroups = groupFillsByPosition(fills);

  const totalPnl = positionGroups.reduce((sum, g) => sum + g.totalPnl, 0);
  const winningTrades = positionGroups.filter(g => g.totalPnl > 0);
  const losingTrades = positionGroups.filter(g => g.totalPnl < 0);

  const winCount = winningTrades.length;
  const lossCount = losingTrades.length;
  const totalTrades = positionGroups.length;
  const winRate = totalTrades > 0 ? (winCount / totalTrades) * 100 : 0;

  const totalWins = winningTrades.reduce((sum, g) => sum + g.totalPnl, 0);
  const totalLosses = Math.abs(losingTrades.reduce((sum, g) => sum + g.totalPnl, 0));
  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;

  const avgWin = winCount > 0 ? totalWins / winCount : 0;
  const avgLoss = lossCount > 0 ? totalLosses / lossCount : 0;

  const totalFees = positionGroups.reduce((sum, g) => sum + g.totalFees, 0);

  const unrealizedPnl = positions.reduce((sum, pos) => {
    const szi = parseFloat(pos.position.szi);
    const entryPx = parseFloat(pos.position.entryPx);
    const markPx = parseFloat(pos.position.positionValue) / Math.abs(szi);
    const pnl = szi * (markPx - entryPx);
    return sum + pnl;
  }, 0);

  return {
    totalPnl,
    winRate,
    profitFactor,
    totalTrades,
    avgWin,
    avgLoss,
    totalFees,
    unrealizedPnl
  };
};

const fetchWithTimeout = <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
    )
  ]);
};

export const useWatchlistStore = create<WatchlistStore>((set, get) => ({
  watchedWallets: [],
  walletData: new Map(),
  service: null,
  pollingInterval: null,
  isInitialized: false,

  setService: (service) => {
    set({ service });
  },

  initialize: () => {
    const wallets = loadWatchlistFromStorage();
    const snapshots = loadWalletSnapshotsFromStorage();
    const changeHistory = loadChangeHistoryFromStorage();

    const initialWalletData = new Map<string, WalletData>();
    snapshots.forEach((snapshot, address) => {
      initialWalletData.set(address, {
        address: snapshot.address,
        positions: snapshot.positions,
        orders: snapshot.orders,
        recentFills: [],
        statistics: calculateStatistics([], snapshot.positions),
        lastFetched: snapshot.lastFetched,
        changeHistory: changeHistory.get(address) || []
      });
    });

    set({
      watchedWallets: wallets,
      walletData: initialWalletData,
      isInitialized: true
    });
  },

  addWallet: (address: string, nickname?: string) => {
    const { watchedWallets } = get();

    if (watchedWallets.some(w => w.address.toLowerCase() === address.toLowerCase())) {
      return;
    }

    const newWallet: WatchedWallet = {
      address: address.toLowerCase(),
      nickname,
      addedAt: Date.now(),
      isLoading: true
    };

    const updatedWallets = [...watchedWallets, newWallet];
    set({ watchedWallets: updatedWallets });
    saveWatchlistToStorage(updatedWallets);

    get().fetchWalletData(address);
  },

  removeWallet: (address: string) => {
    const { watchedWallets, walletData } = get();
    const normalizedAddress = address.toLowerCase();
    const updatedWallets = watchedWallets.filter(
      w => w.address !== normalizedAddress
    );

    const newWalletData = new Map(walletData);
    newWalletData.delete(normalizedAddress);

    set({ watchedWallets: updatedWallets, walletData: newWalletData });
    saveWatchlistToStorage(updatedWallets);

    const snapshots = loadWalletSnapshotsFromStorage();
    snapshots.delete(normalizedAddress);
    saveWalletSnapshotsToStorage(snapshots);

    const changeHistory = loadChangeHistoryFromStorage();
    changeHistory.delete(normalizedAddress);
    saveChangeHistoryToStorage(changeHistory);
  },

  updateNickname: (address: string, nickname: string) => {
    const { watchedWallets } = get();
    const updatedWallets = watchedWallets.map(w =>
      w.address.toLowerCase() === address.toLowerCase()
        ? { ...w, nickname }
        : w
    );

    set({ watchedWallets: updatedWallets });
    saveWatchlistToStorage(updatedWallets);
  },

  toggleFollow: (address: string) => {
    const { watchedWallets } = get();
    const updatedWallets = watchedWallets.map(w =>
      w.address.toLowerCase() === address.toLowerCase()
        ? { ...w, isFollowed: !w.isFollowed }
        : w
    );

    set({ watchedWallets: updatedWallets });
    saveWatchlistToStorage(updatedWallets);
  },

  fetchWalletData: async (address: string) => {
    const { service, watchedWallets, walletData } = get();
    if (!service) return;

    const normalizedAddress = address.toLowerCase();
    const wallet = watchedWallets.find(w => w.address === normalizedAddress);
    const previousData = walletData.get(normalizedAddress);
    const isFollowed = wallet?.isFollowed || false;

    set({
      watchedWallets: watchedWallets.map(w =>
        w.address === normalizedAddress ? { ...w, isLoading: true } : w
      )
    });

    try {
      const now = Date.now();
      const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
      const TIMEOUT_MS = 30000;

      const results = await Promise.allSettled([
        fetchWithTimeout(service.getOpenPositions(address), TIMEOUT_MS),
        fetchWithTimeout(service.getOpenOrders(address), TIMEOUT_MS),
        fetchWithTimeout(service.getUserFillsByTime(thirtyDaysAgo, now, address), TIMEOUT_MS),
        fetchWithTimeout(service.getAccountBalance(address), TIMEOUT_MS)
      ]);

      const positions = results[0].status === 'fulfilled' ? results[0].value : [];
      const orders = results[1].status === 'fulfilled' ? results[1].value : [];
      const recentFills = results[2].status === 'fulfilled' ? results[2].value : [];
      const balance = results[3].status === 'fulfilled' ? results[3].value : undefined;

      if (results[0].status === 'rejected') {
        console.error(`Failed to fetch positions for ${address}:`, results[0].reason);
      }
      if (results[1].status === 'rejected') {
        console.error(`Failed to fetch orders for ${address}:`, results[1].reason);
      }
      if (results[2].status === 'rejected') {
        console.error(`Failed to fetch fills for ${address}:`, results[2].reason);
      }
      if (results[3].status === 'rejected') {
        console.error(`Failed to fetch balance for ${address}:`, results[3].reason);
      }

      const statistics = calculateStatistics(recentFills, positions);

      let changeHistory = previousData?.changeHistory || loadChangeHistoryFromStorage().get(normalizedAddress) || [];

      if (previousData) {
        const walletNickname = wallet?.nickname;

        const previousPositions = previousData.positions;
        const currentPositions = positions;

        const previousCoins = new Set(previousPositions.map(p => p.position.coin));
        const currentCoins = new Set(currentPositions.map(p => p.position.coin));

        currentPositions.forEach(pos => {
          if (!previousCoins.has(pos.position.coin)) {
            const szi = parseFloat(pos.position.szi);
            const side = szi > 0 ? 'long' : 'short';
            const entryPx = parseFloat(pos.position.entryPx);

            changeHistory = addChangeEvent(normalizedAddress, {
              timestamp: Date.now(),
              type: 'position_opened',
              coin: pos.position.coin,
              side,
              size: Math.abs(szi),
              price: entryPx
            });

            if (isFollowed) {
              notifyNewPosition(normalizedAddress, walletNickname, pos);
            }
          } else {
            const prevPos = previousPositions.find(p => p.position.coin === pos.position.coin);
            if (prevPos) {
              const prevSize = Math.abs(parseFloat(prevPos.position.szi));
              const currSize = Math.abs(parseFloat(pos.position.szi));
              if (currSize < prevSize) {
                const side = parseFloat(pos.position.szi) > 0 ? 'long' : 'short';
                const reduced = prevSize - currSize;

                changeHistory = addChangeEvent(normalizedAddress, {
                  timestamp: Date.now(),
                  type: 'position_reduced',
                  coin: pos.position.coin,
                  side,
                  size: reduced
                });

                if (isFollowed) {
                  notifyReducedPosition(normalizedAddress, walletNickname, pos.position.coin, prevSize, currSize, side);
                }
              }
            }
          }
        });

        previousPositions.forEach(prevPos => {
          if (!currentCoins.has(prevPos.position.coin)) {
            const unrealizedPnl = parseFloat(prevPos.position.unrealizedPnl);
            const szi = parseFloat(prevPos.position.szi);
            const side = szi > 0 ? 'long' : 'short';

            changeHistory = addChangeEvent(normalizedAddress, {
              timestamp: Date.now(),
              type: 'position_closed',
              coin: prevPos.position.coin,
              side,
              size: Math.abs(szi),
              pnl: unrealizedPnl
            });

            if (isFollowed) {
              notifyClosedPosition(normalizedAddress, walletNickname, prevPos);
            }
          }
        });

        const previousOrders = previousData.orders;
        const currentOrders = orders;

        const previousOrderIds = new Set(previousOrders.map(o => o.oid.toString()));
        const currentOrderIds = new Set(currentOrders.map(o => o.oid.toString()));

        currentOrders.forEach(order => {
          if (!previousOrderIds.has(order.oid.toString())) {
            const side = order.side === 'A' ? 'sell' : 'buy';
            const size = Math.abs(parseFloat(order.origSz || order.sz || '0'));
            const price = order.isTrigger ? parseFloat(order.triggerPx || '0') : parseFloat(order.limitPx || '0');

            changeHistory = addChangeEvent(normalizedAddress, {
              timestamp: Date.now(),
              type: 'order_placed',
              coin: order.coin,
              side,
              size,
              price
            });

            if (isFollowed) {
              notifyNewOrder(normalizedAddress, walletNickname, order);
            }
          }
        });

        previousOrders.forEach(order => {
          if (!currentOrderIds.has(order.oid.toString())) {
            const side = order.side === 'A' ? 'sell' : 'buy';
            const size = Math.abs(parseFloat(order.origSz || order.sz || '0'));
            const price = order.isTrigger ? parseFloat(order.triggerPx || '0') : parseFloat(order.limitPx || '0');

            changeHistory = addChangeEvent(normalizedAddress, {
              timestamp: Date.now(),
              type: 'order_cancelled',
              coin: order.coin,
              side,
              size,
              price
            });

            if (isFollowed) {
              notifyRemovedOrder(normalizedAddress, walletNickname, order);
            }
          }
        });
      }

      const newWalletData: WalletData = {
        address: normalizedAddress,
        positions,
        orders,
        recentFills: recentFills.sort((a, b) => b.time - a.time).slice(0, 50),
        balance,
        statistics,
        lastFetched: Date.now(),
        changeHistory
      };

      const updatedWalletData = new Map(walletData);
      updatedWalletData.set(normalizedAddress, newWalletData);

      set({
        walletData: updatedWalletData,
        watchedWallets: watchedWallets.map(w =>
          w.address === normalizedAddress
            ? { ...w, isLoading: false, lastFetched: Date.now() }
            : w
        )
      });

      const snapshots = loadWalletSnapshotsFromStorage();
      snapshots.set(normalizedAddress, {
        address: normalizedAddress,
        positions,
        orders,
        lastFetched: Date.now()
      });
      saveWalletSnapshotsToStorage(snapshots);
    } catch (error) {
      console.error(`Failed to fetch data for wallet ${address}:`, error);

      set({
        watchedWallets: watchedWallets.map(w =>
          w.address === normalizedAddress ? { ...w, isLoading: false } : w
        )
      });
    }
  },

  fetchAllWalletsData: async () => {
    const { watchedWallets } = get();

    await Promise.all(
      watchedWallets.map(wallet => get().fetchWalletData(wallet.address))
    );
  },

  startPolling: () => {
    const { pollingInterval } = get();

    if (pollingInterval) {
      clearInterval(pollingInterval);
    }

    get().fetchAllWalletsData();

    const interval = setInterval(() => {
      get().fetchAllWalletsData();
    }, POLLING_INTERVAL);

    set({ pollingInterval: interval });
  },

  stopPolling: () => {
    const { pollingInterval } = get();

    if (pollingInterval) {
      clearInterval(pollingInterval);
      set({ pollingInterval: null });
    }
  },

  clearWalletData: (address: string) => {
    const { walletData } = get();
    const normalizedAddress = address.toLowerCase();
    const newWalletData = new Map(walletData);
    newWalletData.delete(normalizedAddress);
    set({ walletData: newWalletData });

    const snapshots = loadWalletSnapshotsFromStorage();
    snapshots.delete(normalizedAddress);
    saveWalletSnapshotsToStorage(snapshots);

    const changeHistory = loadChangeHistoryFromStorage();
    changeHistory.delete(normalizedAddress);
    saveChangeHistoryToStorage(changeHistory);
  }
}));
