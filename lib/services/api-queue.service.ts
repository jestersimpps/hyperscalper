import {
  QueuePriority,
  QueuedRequest,
  QueueMetrics,
  QueueConfig,
  RequestExecutor,
} from '@/lib/models/api-queue.model';
import { toast } from 'sonner';

export class APIQueueService {
  private static instance: APIQueueService;
  private queues: Map<QueuePriority, QueuedRequest<unknown>[]>;
  private availableTokens: number;
  private maxTokens: number;
  private refillRate: number;
  private refillInterval: number;
  private processing: boolean = false;
  private refillTimerId: NodeJS.Timeout | null = null;
  private droppedRequests: number = 0;
  private processedRequests: number = 0;
  private dedupeCache: Map<string, Promise<unknown>>;

  private constructor(config?: Partial<QueueConfig>) {
    this.maxTokens = config?.maxTokens ?? 1200;
    this.refillRate = config?.refillRate ?? 20;
    this.refillInterval = config?.refillInterval ?? 1000;
    this.availableTokens = this.maxTokens;

    this.queues = new Map([
      [QueuePriority.HIGH, []],
      [QueuePriority.MEDIUM, []],
      [QueuePriority.LOW, []],
    ]);

    this.dedupeCache = new Map();

    this.startTokenRefill();
    this.startProcessing();
  }

  static getInstance(config?: Partial<QueueConfig>): APIQueueService {
    if (!APIQueueService.instance) {
      APIQueueService.instance = new APIQueueService(config);
    }
    return APIQueueService.instance;
  }

  private startTokenRefill(): void {
    this.refillTimerId = setInterval(() => {
      this.availableTokens = Math.min(
        this.maxTokens,
        this.availableTokens + this.refillRate
      );
    }, this.refillInterval);
  }

  private startProcessing(): void {
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (true) {
      const request = this.getNextRequest();

      if (!request) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        continue;
      }

      if (this.availableTokens >= request.weight) {
        this.availableTokens -= request.weight;

        try {
          const result = await request.execute();
          request.resolve(result);
          this.processedRequests++;

          if (request.dedupeKey) {
            this.dedupeCache.delete(request.dedupeKey);
          }
        } catch (error) {
          request.reject(error as Error);

          if (request.dedupeKey) {
            this.dedupeCache.delete(request.dedupeKey);
          }
        }
      } else {
        const queue = this.queues.get(request.priority)!;
        queue.unshift(request);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
  }

  private getNextRequest(): QueuedRequest<unknown> | null {
    for (const priority of [
      QueuePriority.HIGH,
      QueuePriority.MEDIUM,
      QueuePriority.LOW,
    ]) {
      const queue = this.queues.get(priority)!;
      if (queue.length > 0) {
        return queue.shift()!;
      }
    }
    return null;
  }

  async enqueue<T>(
    executor: RequestExecutor<T>,
    priority: QueuePriority,
    weight: number,
    dedupeKey?: string
  ): Promise<T> {
    if (dedupeKey && this.dedupeCache.has(dedupeKey)) {
      return this.dedupeCache.get(dedupeKey) as Promise<T>;
    }

    if (this.getTotalQueueSize() >= 1000) {
      this.droppedRequests++;
      toast.error('API rate limit queue full. Request dropped.', {
        duration: 3000,
      });
      throw new Error('Queue full - request dropped to prevent rate limiting');
    }

    const promise = new Promise<T>((resolve, reject) => {
      const request: QueuedRequest<T> = {
        id: `${Date.now()}-${Math.random()}`,
        priority,
        weight,
        execute: executor,
        resolve,
        reject,
        timestamp: Date.now(),
        dedupeKey,
      };

      const queue = this.queues.get(priority)!;
      queue.push(request as QueuedRequest<unknown>);
    });

    if (dedupeKey) {
      this.dedupeCache.set(dedupeKey, promise);
    }

    return promise;
  }

  private getTotalQueueSize(): number {
    return Array.from(this.queues.values()).reduce(
      (sum, queue) => sum + queue.length,
      0
    );
  }

  getMetrics(): QueueMetrics {
    return {
      availableTokens: this.availableTokens,
      queueSize: this.getTotalQueueSize(),
      droppedRequests: this.droppedRequests,
      processedRequests: this.processedRequests,
    };
  }

  destroy(): void {
    if (this.refillTimerId) {
      clearInterval(this.refillTimerId);
      this.refillTimerId = null;
    }
    this.queues.clear();
    this.dedupeCache.clear();
  }
}

export const apiQueue = APIQueueService.getInstance();
