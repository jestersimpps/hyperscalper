export enum QueuePriority {
  HIGH = 0,
  MEDIUM = 1,
  LOW = 2,
}

export enum EndpointWeight {
  TRADING = 1,
  HEAVY_INFO = 2,
  REGULAR_INFO = 20,
  USER_ROLE = 60,
  EXPLORER = 40,
}

export interface QueuedRequest<T> {
  id: string;
  priority: QueuePriority;
  weight: number;
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  timestamp: number;
  dedupeKey?: string;
}

export interface QueueMetrics {
  availableTokens: number;
  queueSize: number;
  droppedRequests: number;
  processedRequests: number;
}

export interface QueueConfig {
  maxTokens: number;
  refillRate: number;
  refillInterval: number;
}

export type RequestExecutor<T> = () => Promise<T>;
