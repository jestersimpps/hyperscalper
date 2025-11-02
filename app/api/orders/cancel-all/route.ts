import { NextRequest, NextResponse } from 'next/server';
import { getHyperliquidService } from '@/lib/services/hyperliquid.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { symbol } = body;

    if (!symbol) {
      return NextResponse.json(
        {
          success: false,
          message: 'Missing required parameter: symbol',
        },
        { status: 400 }
      );
    }

    const hlService = getHyperliquidService();
    const result = await hlService.cancelAllOrders(symbol);

    return NextResponse.json({
      success: true,
      message: `Cancelled all orders for ${symbol}`,
      data: result,
    });
  } catch (error) {
    console.error('Error cancelling all orders:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to cancel all orders',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
