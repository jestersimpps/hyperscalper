import { NextRequest, NextResponse } from 'next/server';
import { SmShortRequest, TradeResponse, POSITION_SIZES } from '@/models/TradeRequest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse<TradeResponse>> {
  try {
    const body = await request.json();
    const { symbol } = body;

    const tradeData: SmShortRequest = {
      symbol,
      type: 'sm-short',
      size: POSITION_SIZES.SM,
      timestamp: Date.now(),
    };

    console.log('Executing SM SHORT for', symbol, 'with size', POSITION_SIZES.SM);
    console.log('Trade data:', tradeData);

    return NextResponse.json({
      success: true,
      message: `Small Short order placed for ${symbol}`,
      data: {
        symbol: tradeData.symbol,
        type: tradeData.type,
        size: tradeData.size,
        timestamp: tradeData.timestamp,
      },
    });
  } catch (error) {
    console.error('Error executing sm short:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to execute small short order',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
