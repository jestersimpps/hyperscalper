import { NextRequest, NextResponse } from 'next/server';
import { ClosePositionRequest, ClosePositionResponse } from '@/models/Position';

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

    const closeData: ClosePositionRequest = {
      symbol,
      percentage,
      timestamp: Date.now(),
    };

    return NextResponse.json({
      success: true,
      message: `Closed ${percentage}% of ${symbol} position`,
      data: {
        symbol: closeData.symbol,
        percentage: closeData.percentage,
        timestamp: closeData.timestamp,
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
