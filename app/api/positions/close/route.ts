import { NextRequest, NextResponse } from 'next/server';
import { ClosePositionRequest, ClosePositionResponse } from '@/models/Position';
import { getHyperliquidService } from '@/lib/services/hyperliquid.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse<ClosePositionResponse>> {
  try {
    const body = await request.json();
    const { symbol, percentage } = body;

    if (![25, 50, 75, 100].includes(percentage)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid percentage. Must be 25, 50, 75, or 100',
          error: 'Invalid percentage value',
        },
        { status: 400 }
      );
    }

    const hlService = getHyperliquidService();
    const positions = await hlService.getOpenPositions();
    const position = positions.find(p => p.position.coin === symbol);

    if (!position) {
      return NextResponse.json(
        {
          success: false,
          message: `No open position for ${symbol}`,
          error: 'Position not found',
        },
        { status: 404 }
      );
    }

    const fullSize = Math.abs(parseFloat(position.position.szi));
    const sizeToClose = percentage === 100 ? undefined : ((fullSize * percentage) / 100).toString();

    const result = await hlService.closePosition({
      coin: symbol,
      size: sizeToClose,
    });

    const timestamp = Date.now();

    return NextResponse.json({
      success: true,
      message: `Closed ${percentage}% of ${symbol} position`,
      data: {
        symbol,
        percentage,
        timestamp,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to close position',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
