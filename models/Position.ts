export type ClosePercentage = 25 | 50 | 75 | 100;

export interface ClosePositionRequest {
  symbol: string;
  percentage: ClosePercentage;
  timestamp: number;
}

export interface ClosePositionResponse {
  success: boolean;
  message: string;
  data?: {
    symbol: string;
    percentage: ClosePercentage;
    timestamp: number;
  };
  error?: string;
}

export interface Position {
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercentage: number;
  leverage: number;
}
