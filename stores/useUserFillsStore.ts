import { create } from 'zustand';
import type { UserFill } from '@/types';
import type { HyperliquidService } from '@/lib/services/hyperliquid.service';
import { groupFillsByPosition } from '@/lib/trade-grouping-utils';

export interface DailyPnlSummary {
  date: string;
  totalPnl: number;
  fillCount: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  averagePnl: number;
  bestTrade: { coin: string; pnl: number } | null;
  worstTrade: { coin: string; pnl: number } | null;
  totalFees: number;
  chartData: Array<{ time: number; cumulativePnl: number }>;
}

interface UserFillsStore {
  fills: UserFill[];
  loading: boolean;
  error: string | null;
  service: HyperliquidService | null;
  selectedDate: Date;
  selectedMonth: Date;
  monthlyFills: UserFill[];
  dailySummaries: DailyPnlSummary[];

  setService: (service: HyperliquidService) => void;
  setSelectedDate: (date: Date) => void;
  fetchTodaysFills: () => Promise<void>;
  fetchFillsByTime: (startTime: number, endTime?: number) => Promise<void>;
  fetchSelectedDateFills: () => Promise<void>;
  fetchMonthFills: () => Promise<void>;
  goToPreviousDay: () => void;
  goToNextDay: () => void;
  goToToday: () => void;
  goToPreviousMonth: () => void;
  goToNextMonth: () => void;
  goToThisMonth: () => void;
  clearFills: () => void;
}

const getTodayTimestamps = (): { startTime: number; endTime: number } => {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  return {
    startTime: startOfToday.getTime(),
    endTime: now.getTime()
  };
};

const getDateTimestamps = (date: Date): { startTime: number; endTime: number } => {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const now = new Date();
  const isToday = startOfDay.toDateString() === now.toDateString();

  return {
    startTime: startOfDay.getTime(),
    endTime: isToday ? now.getTime() : endOfDay.getTime()
  };
};

const getMonthTimestamps = (date: Date): { startTime: number; endTime: number } => {
  const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  startOfMonth.setHours(0, 0, 0, 0);

  const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  endOfMonth.setHours(23, 59, 59, 999);

  const now = new Date();
  const isCurrentMonth = startOfMonth.getMonth() === now.getMonth() &&
                         startOfMonth.getFullYear() === now.getFullYear();

  return {
    startTime: startOfMonth.getTime(),
    endTime: isCurrentMonth ? now.getTime() : endOfMonth.getTime()
  };
};

const calculateDailySummaries = (fills: UserFill[]): DailyPnlSummary[] => {
  const fillsByDate = new Map<string, UserFill[]>();

  fills.forEach(fill => {
    const fillDate = new Date(fill.time);
    const dateKey = fillDate.toISOString().split('T')[0];

    if (!fillsByDate.has(dateKey)) {
      fillsByDate.set(dateKey, []);
    }
    fillsByDate.get(dateKey)!.push(fill);
  });

  return Array.from(fillsByDate.entries()).map(([date, dayFills]) => {
    const positionGroups = groupFillsByPosition(dayFills);

    if (positionGroups.length === 0) {
      return {
        date,
        totalPnl: 0,
        fillCount: dayFills.length,
        winCount: 0,
        lossCount: 0,
        winRate: 0,
        averagePnl: 0,
        bestTrade: null,
        worstTrade: null,
        totalFees: 0,
        chartData: []
      };
    }

    const totalPnl = positionGroups.reduce((sum, g) => sum + g.totalPnl, 0);
    const winCount = positionGroups.filter(g => g.totalPnl > 0).length;
    const lossCount = positionGroups.filter(g => g.totalPnl < 0).length;
    const winRate = positionGroups.length > 0 ? (winCount / positionGroups.length) * 100 : 0;
    const averagePnl = positionGroups.length > 0 ? totalPnl / positionGroups.length : 0;

    const bestTrade = positionGroups.reduce((best, g) =>
      !best || g.totalPnl > best.totalPnl ? g : best
    );

    const worstTrade = positionGroups.reduce((worst, g) =>
      !worst || g.totalPnl < worst.totalPnl ? g : worst
    );

    const totalFees = positionGroups.reduce((sum, g) => sum + g.totalFees, 0);

    const sortedGroups = [...positionGroups].sort((a, b) => a.exitTime - b.exitTime);
    const chartData: Array<{ time: number; cumulativePnl: number }> = [];
    let cumulativePnl = 0;

    chartData.push({ time: sortedGroups[0].entryTime, cumulativePnl: 0 });

    sortedGroups.forEach((group) => {
      cumulativePnl += group.totalPnl;
      chartData.push({ time: group.exitTime, cumulativePnl });
    });

    return {
      date,
      totalPnl,
      fillCount: dayFills.length,
      winCount,
      lossCount,
      winRate,
      averagePnl,
      bestTrade: { coin: bestTrade.coin, pnl: bestTrade.totalPnl },
      worstTrade: { coin: worstTrade.coin, pnl: worstTrade.totalPnl },
      totalFees,
      chartData
    };
  }).sort((a, b) => a.date.localeCompare(b.date));
};

export const useUserFillsStore = create<UserFillsStore>((set, get) => ({
  fills: [],
  loading: false,
  error: null,
  service: null,
  selectedDate: new Date(),
  selectedMonth: new Date(),
  monthlyFills: [],
  dailySummaries: [],

  setService: (service) => {
    set({ service });
  },

  setSelectedDate: (date) => {
    set({ selectedDate: date });
  },

  fetchTodaysFills: async () => {
    const { service } = get();
    if (!service) {
      set({ error: 'Service not initialized' });
      return;
    }

    set({ loading: true, error: null });

    try {
      const { startTime, endTime } = getTodayTimestamps();
      const fills = await service.getUserFillsByTime(startTime, endTime);

      set({
        fills: fills.sort((a, b) => b.time - a.time),
        loading: false
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch fills',
        loading: false
      });
    }
  },

  fetchFillsByTime: async (startTime: number, endTime?: number) => {
    const { service } = get();
    if (!service) {
      set({ error: 'Service not initialized' });
      return;
    }

    set({ loading: true, error: null });

    try {
      const fills = await service.getUserFillsByTime(startTime, endTime);

      set({
        fills: fills.sort((a, b) => b.time - a.time),
        loading: false
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch fills',
        loading: false
      });
    }
  },

  fetchSelectedDateFills: async () => {
    const { service, selectedDate } = get();
    if (!service) {
      set({ error: 'Service not initialized' });
      return;
    }

    set({ loading: true, error: null });

    try {
      const { startTime, endTime } = getDateTimestamps(selectedDate);
      const fills = await service.getUserFillsByTime(startTime, endTime);

      set({
        fills: fills.sort((a, b) => b.time - a.time),
        loading: false
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch fills',
        loading: false
      });
    }
  },

  goToPreviousDay: () => {
    const { selectedDate } = get();
    const previousDay = new Date(selectedDate);
    previousDay.setDate(previousDay.getDate() - 1);
    set({ selectedDate: previousDay });
  },

  goToNextDay: () => {
    const { selectedDate } = get();
    const nextDay = new Date(selectedDate);
    nextDay.setDate(nextDay.getDate() + 1);
    set({ selectedDate: nextDay });
  },

  goToToday: () => {
    set({ selectedDate: new Date() });
  },

  fetchMonthFills: async () => {
    const { service, selectedMonth } = get();
    if (!service) {
      set({ error: 'Service not initialized' });
      return;
    }

    set({ loading: true, error: null });

    try {
      const { startTime, endTime } = getMonthTimestamps(selectedMonth);
      const fills = await service.getUserFillsByTime(startTime, endTime);

      const summaries = calculateDailySummaries(fills);

      set({
        monthlyFills: fills.sort((a, b) => b.time - a.time),
        dailySummaries: summaries,
        loading: false
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch month fills',
        loading: false
      });
    }
  },

  goToPreviousMonth: () => {
    const { selectedMonth } = get();
    const previousMonth = new Date(selectedMonth);
    previousMonth.setMonth(previousMonth.getMonth() - 1);
    set({ selectedMonth: previousMonth });
  },

  goToNextMonth: () => {
    const { selectedMonth } = get();
    const nextMonth = new Date(selectedMonth);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    set({ selectedMonth: nextMonth });
  },

  goToThisMonth: () => {
    set({ selectedMonth: new Date() });
  },

  clearFills: () => {
    set({ fills: [], error: null });
  }
}));
