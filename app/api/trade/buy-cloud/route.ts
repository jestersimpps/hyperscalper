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
      const level = currentPrice - (priceInterval * i / ORDER_COUNT);
      priceLevels.push(level);
    }

    const accountBalance = await hlService.getAccountBalance();
    const accountValue = parseFloat(accountBalance.accountValue);
    const cloudSize = (accountValue * percentage) / 100;

    const placedOrders = [];
    const errors = [];

    for (const level of priceLevels) {
      try {
        const formattedPrice = await hlService.formatPrice(level, symbol);
        const coinSize = cloudSize / level;
        const formattedSize = await hlService.formatSize(coinSize, symbol);

        const orderResult = await hlService.placeLimitOrder({
          coin: symbol,
          isBuy: true,
          price: formattedPrice,
          size: formattedSize,
          reduceOnly: false,
        });

        placedOrders.push({
          price: formattedPrice,
          size: formattedSize,
          result: orderResult,
        });
      } catch (error) {
        errors.push({
          price: level,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: placedOrders.length > 0,
      message: `Placed ${placedOrders.length} buy cloud orders for ${symbol}`,
      data: {
        symbol,
        currentPrice,
        priceInterval,
        priceLevels,
        placedOrders,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error) {
    console.error('Error executing buy cloud:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to execute buy cloud order',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
