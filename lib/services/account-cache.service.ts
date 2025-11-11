import type { HyperliquidService } from './hyperliquid.service';
import type { AccountBalance } from './types';

export class AccountBalanceCache {
  private static instance: AccountBalanceCache;
  private balance: AccountBalance | null = null;
  private lastFetch: number = 0;
  private readonly TTL = 5000;

  private constructor() {}

  static getInstance(): AccountBalanceCache {
    if (!AccountBalanceCache.instance) {
      AccountBalanceCache.instance = new AccountBalanceCache();
    }
    return AccountBalanceCache.instance;
  }

  async getBalance(service: HyperliquidService, user?: string): Promise<AccountBalance> {
    if (this.balance && Date.now() - this.lastFetch < this.TTL) {
      return this.balance;
    }

    this.balance = await service.getAccountBalance(user);
    this.lastFetch = Date.now();
    return this.balance;
  }

  invalidate(): void {
    this.balance = null;
    this.lastFetch = 0;
  }
}

export const accountCache = AccountBalanceCache.getInstance();
