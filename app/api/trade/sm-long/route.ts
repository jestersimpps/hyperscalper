import { NextRequest, NextResponse } from 'next/server';
import { SmLongRequest, TradeResponse, POSITION_SIZES } from '@/models/TradeRequest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse<TradeResponse>> {
  try {
    const body = await request.json();
    const { symbol } = body;

    const tradeData: SmLongRequest = {
      symbol,
      type: 'sm-long',
      size: POSITION_SIZES.SM,
      timestamp: Date.now(),
    };

    console.log('Executing SM LONG for', symbol, 'with size', POSITION_SIZES.SM);
    console.log('Trade data:', tradeData);

    return NextResponse.json({
      success: true,
      message: `Small Long order placed for ${symbol}`,
      data: {
        symbol: tradeData.symbol,
        type: tradeData.type,
        size: tradeData.size,
        timestamp: tradeData.timestamp,
      },
    });
  } catch (error) {
    console.error('Error executing sm long:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to execute small long order',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
