import { NextRequest, NextResponse } from 'next/server';
import { BigLongRequest, TradeResponse, POSITION_SIZES } from '@/models/TradeRequest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse<TradeResponse>> {
  try {
    const body = await request.json();
    const { symbol } = body;

    const tradeData: BigLongRequest = {
      symbol,
      type: 'big-long',
      size: POSITION_SIZES.BIG,
      timestamp: Date.now(),
    };

    console.log('Executing BIG LONG for', symbol, 'with size', POSITION_SIZES.BIG);
    console.log('Trade data:', tradeData);

    return NextResponse.json({
      success: true,
      message: `Big Long order placed for ${symbol}`,
      data: {
        symbol: tradeData.symbol,
        type: tradeData.type,
        size: tradeData.size,
        timestamp: tradeData.timestamp,
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
