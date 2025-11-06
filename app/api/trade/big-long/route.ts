import { NextRequest, NextResponse } from 'next/server';
import { getHyperliquidService } from '@/lib/services/hyperliquid.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { symbol, currentPrice, percentage, priceInterval } = body;

    if (!symbol || !currentPrice || !percentage || !priceInterval) {
      return NextResponse.json(
        {
          success: false,
          message: 'Missing required parameters: symbol, currentPrice, percentage, priceInterval',
        },
        { status: 400 }
      );
    }

    const hlService = getHyperliquidService();

    const accountBalance = await hlService.getAccountBalance();
    const accountValue = parseFloat(accountBalance.accountValue);
    const positionSize = (accountValue * percentage) / 100;

    const coinSize = positionSize / currentPrice;
    const formattedSize = await hlService.formatSize(coinSize, symbol);

    const orderResult = await hlService.placeMarketBuy(symbol, formattedSize);

    const stopLossPrice = currentPrice - (8 * priceInterval);
    const formattedStopLoss = await hlService.formatPrice(stopLossPrice, symbol);

    const TAKE_PROFIT_PERCENT = 2;
    const takeProfitPrice = currentPrice * (1 + TAKE_PROFIT_PERCENT / 100);
    const formattedTakeProfit = await hlService.formatPrice(takeProfitPrice, symbol);

    const stopLossResult = await hlService.placeStopLoss({
      coin: symbol,
      triggerPrice: formattedStopLoss,
      size: formattedSize,
      isBuy: false,
    });

    const takeProfitResult = await hlService.placeTakeProfit({
      coin: symbol,
      triggerPrice: formattedTakeProfit,
      size: formattedSize,
      isBuy: false,
    });

    return NextResponse.json({
      success: true,
      message: `Big Long market order placed for ${symbol} with SL/TP`,
      data: {
        symbol,
        currentPrice,
        percentage,
        priceInterval,
        positionSize,
        formattedSize,
        orderResult,
        stopLoss: {
          price: formattedStopLoss,
          size: formattedSize,
          result: stopLossResult,
        },
        takeProfit: {
          price: formattedTakeProfit,
          size: formattedSize,
          result: takeProfitResult,
        },
      },
    });
  } catch (error) {
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
