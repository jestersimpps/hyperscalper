import { NextRequest, NextResponse } from 'next/server';
import { getHyperliquidService } from '@/lib/services/hyperliquid.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { coin, percentage } = body;

    if (!coin || !percentage) {
      return NextResponse.json(
        {
          success: false,
          message: 'Missing required parameters: coin, percentage',
        },
        { status: 400 }
      );
    }

    if (![0, 25, 50, 75].includes(percentage)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Percentage must be 0, 25, 50, or 75',
        },
        { status: 400 }
      );
    }

    const hlService = getHyperliquidService();

    const positions = await hlService.getOpenPositions();
    const allMids = await hlService.getAllMids();
    const assetPosition = positions.find(p => p.position.coin === coin);

    if (!assetPosition) {
      return NextResponse.json(
        {
          success: false,
          message: `No open position found for ${coin}`,
        },
        { status: 404 }
      );
    }

    const szi = parseFloat(assetPosition.position.szi);
    const entryPrice = parseFloat(assetPosition.position.entryPx || '0');
    const currentPrice = parseFloat(allMids[coin] || '0');
    const side: 'long' | 'short' = szi > 0 ? 'long' : 'short';
    const size = Math.abs(szi);

    let newStopLossPrice: number;
    if (side === 'long') {
      newStopLossPrice = entryPrice + (currentPrice - entryPrice) * (percentage / 100);
    } else {
      newStopLossPrice = entryPrice - (entryPrice - currentPrice) * (percentage / 100);
    }

    const allOrders = await hlService.getOpenOrders();
    const stopLossOrders = allOrders.filter((order: any) => {
      if (order.coin !== coin) return false;
      if (!order.isTrigger || !order.isPositionTpsl) return false;
      const ot = order.orderType?.toLowerCase() || '';
      return ot.includes('stop market') || order.reduceOnly;
    });

    if (stopLossOrders.length > 0) {
      for (const slOrder of stopLossOrders) {
        const orderId = parseInt(slOrder.oid);
        await hlService.cancelOrder(coin, orderId);
      }
    }

    const formattedStopLoss = await hlService.formatPrice(newStopLossPrice, coin);
    const formattedSize = await hlService.formatSize(size, coin);

    const stopLossResult = await hlService.placeStopLoss({
      coin,
      triggerPrice: formattedStopLoss,
      size: formattedSize,
      isBuy: side === 'short',
    });

    return NextResponse.json({
      success: true,
      message: `Moved stop loss to ${percentage}% toward current price for ${coin}`,
      data: {
        coin,
        side,
        entryPrice,
        currentPrice,
        percentage,
        newStopLossPrice: formattedStopLoss,
        size: formattedSize,
        cancelledOrders: stopLossOrders.length,
        result: stopLossResult,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to move stop loss',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
