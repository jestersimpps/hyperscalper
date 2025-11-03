import { NextRequest, NextResponse } from 'next/server';
import { getHyperliquidService } from '@/lib/services/hyperliquid.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ORDER_COUNT = 5;

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { symbol, currentPrice, priceInterval, percentage } = body;

    if (!symbol || !currentPrice || !priceInterval || !percentage) {
      return NextResponse.json(
        {
          success: false,
          message: 'Missing required parameters: symbol, currentPrice, priceInterval, percentage',
        },
        { status: 400 }
      );
    }

    const hlService = getHyperliquidService();

    const priceLevels: number[] = [];
    for (let i = 1; i <= ORDER_COUNT; i++) {
      const level = currentPrice + (2 * priceInterval * i / ORDER_COUNT);
      priceLevels.push(level);
    }

    const accountBalance = await hlService.getAccountBalance();
    const accountValue = parseFloat(accountBalance.accountValue);
    const cloudSize = (accountValue * percentage) / 100;

    const orderParams = [];
    for (const level of priceLevels) {
      const formattedPrice = await hlService.formatPrice(level, symbol);
      const coinSize = cloudSize / level;
      const formattedSize = await hlService.formatSize(coinSize, symbol);

      orderParams.push({
        coin: symbol,
        isBuy: false,
        price: formattedPrice,
        size: formattedSize,
        reduceOnly: false,
      });
    }

    const result = await hlService.placeBatchLimitOrders(orderParams);

    const totalCoinSize = orderParams.reduce((sum, order) => sum + parseFloat(order.size), 0);
    const formattedTotalSize = await hlService.formatSize(totalCoinSize, symbol);

    const stopLossPrice = currentPrice + (8 * priceInterval);
    const formattedStopLoss = await hlService.formatPrice(stopLossPrice, symbol);

    const TAKE_PROFIT_PERCENT = 2;
    const takeProfitPrice = currentPrice * (1 - TAKE_PROFIT_PERCENT / 100);
    const formattedTakeProfit = await hlService.formatPrice(takeProfitPrice, symbol);

    const stopLossResult = await hlService.placeStopLoss({
      coin: symbol,
      triggerPrice: formattedStopLoss,
      size: formattedTotalSize,
      isBuy: true,
    });

    const takeProfitResult = await hlService.placeTakeProfit({
      coin: symbol,
      triggerPrice: formattedTakeProfit,
      size: formattedTotalSize,
      isBuy: true,
    });

    return NextResponse.json({
      success: true,
      message: `Placed ${orderParams.length} sell cloud orders with SL/TP for ${symbol}`,
      data: {
        symbol,
        currentPrice,
        priceInterval,
        priceLevels,
        orders: orderParams,
        result,
        stopLoss: {
          price: formattedStopLoss,
          size: formattedTotalSize,
          result: stopLossResult,
        },
        takeProfit: {
          price: formattedTakeProfit,
          size: formattedTotalSize,
          result: takeProfitResult,
        },
      },
    });
  } catch (error) {
    console.error('Error executing sell cloud:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to execute sell cloud order',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
