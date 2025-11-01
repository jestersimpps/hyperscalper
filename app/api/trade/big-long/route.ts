import { NextRequest, NextResponse } from 'next/server';
import { getHyperliquidService } from '@/lib/services/hyperliquid.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { symbol, currentPrice, percentage } = body;

    if (!symbol || !currentPrice || !percentage) {
      return NextResponse.json(
        {
          success: false,
          message: 'Missing required parameters: symbol, currentPrice, percentage',
        },
        { status: 400 }
      );
    }

    const hlService = getHyperliquidService();

    const accountBalance = await hlService.getAccountBalance();
    const accountValue = parseFloat(accountBalance.accountValue);
    const positionSize = (accountValue * percentage) / 100;

    const formattedPrice = await hlService.formatPrice(currentPrice, symbol);
    const coinSize = positionSize / currentPrice;
    const formattedSize = await hlService.formatSize(coinSize, symbol);

    const orderResult = await hlService.placeLimitOrder({
      coin: symbol,
      isBuy: true,
      price: formattedPrice,
      size: formattedSize,
      reduceOnly: false,
    });

    return NextResponse.json({
      success: true,
      message: `Big Long order placed for ${symbol}`,
      data: {
        symbol,
        currentPrice,
        percentage,
        positionSize,
        formattedPrice,
        formattedSize,
        orderResult,
      },
    });
  } catch (error) {
    console.error('Error executing big long:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to execute big long order',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
