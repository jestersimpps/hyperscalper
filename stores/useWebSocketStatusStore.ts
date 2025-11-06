import { create } from 'zustand';

export type WebSocketStreamType = 'candles' | 'trades' | 'orderbook' | 'prices';
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

interface StreamStatus {
  status: ConnectionStatus;
  lastConnected: number | null;
  errorMessage: string | null;
  subscriptionCount: number;
}

interface WebSocketStatusStore {
  overallStatus: ConnectionStatus;
  streams: Record<WebSocketStreamType, StreamStatus>;

  setOverallStatus: (status: ConnectionStatus) => void;
  setStreamStatus: (stream: WebSocketStreamType, status: ConnectionStatus, errorMessage?: string) => void;
  setStreamSubscriptionCount: (stream: WebSocketStreamType, count: number) => void;
  resetStreamStatus: (stream: WebSocketStreamType) => void;
  getStreamStatus: (stream: WebSocketStreamType) => StreamStatus;
}

const initialStreamStatus: StreamStatus = {
  status: 'disconnected',
  lastConnected: null,
  errorMessage: null,
  subscriptionCount: 0,
};

export const useWebSocketStatusStore = create<WebSocketStatusStore>((set, get) => ({
  overallStatus: 'disconnected',
  streams: {
    candles: { ...initialStreamStatus },
    trades: { ...initialStreamStatus },
    orderbook: { ...initialStreamStatus },
    prices: { ...initialStreamStatus },
  },

  setOverallStatus: (status: ConnectionStatus) => {
    set({ overallStatus: status });
  },

  setStreamStatus: (stream: WebSocketStreamType, status: ConnectionStatus, errorMessage?: string) => {
    set((state) => ({
      streams: {
        ...state.streams,
        [stream]: {
          ...state.streams[stream],
          status,
          lastConnected: status === 'connected' ? Date.now() : state.streams[stream].lastConnected,
          errorMessage: errorMessage || null,
        },
      },
    }));
  },

  setStreamSubscriptionCount: (stream: WebSocketStreamType, count: number) => {
    set((state) => ({
      streams: {
        ...state.streams,
        [stream]: {
          ...state.streams[stream],
          subscriptionCount: count,
          status: count > 0 ? 'connected' : 'disconnected',
        },
      },
    }));
  },

  resetStreamStatus: (stream: WebSocketStreamType) => {
    set((state) => ({
      streams: {
        ...state.streams,
        [stream]: { ...initialStreamStatus },
      },
    }));
  },

  getStreamStatus: (stream: WebSocketStreamType) => {
    return get().streams[stream];
  },
}));
