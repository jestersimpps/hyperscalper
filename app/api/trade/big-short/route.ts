import { NextRequest, NextResponse } from 'next/server';
import { BigShortRequest, TradeResponse, POSITION_SIZES } from '@/models/TradeRequest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse<TradeResponse>> {
  try {
    const body = await request.json();
    const { symbol } = body;

    const tradeData: BigShortRequest = {
      symbol,
      type: 'big-short',
      size: POSITION_SIZES.BIG,
      timestamp: Date.now(),
    };

    console.log('Executing BIG SHORT for', symbol, 'with size', POSITION_SIZES.BIG);
    console.log('Trade data:', tradeData);

    return NextResponse.json({
      success: true,
      message: `Big Short order placed for ${symbol}`,
      data: {
        symbol: tradeData.symbol,
        type: tradeData.type,
        size: tradeData.size,
        timestamp: tradeData.timestamp,
      },
    });
  } catch (error) {
    console.error('Error executing big short:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to execute big short order',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
