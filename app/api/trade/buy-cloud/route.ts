import { NextRequest, NextResponse } from 'next/server';
import { BuyCloudRequest, TradeResponse, POSITION_SIZES } from '@/models/TradeRequest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse<TradeResponse>> {
  try {
    const body = await request.json();
    const { symbol } = body;

    const tradeData: BuyCloudRequest = {
      symbol,
      type: 'buy-cloud',
      size: POSITION_SIZES.CLOUD,
      timestamp: Date.now(),
    };

    console.log('Executing BUY CLOUD for', symbol, 'with size', POSITION_SIZES.CLOUD);
    console.log('Trade data:', tradeData);

    return NextResponse.json({
      success: true,
      message: `Buy Cloud order placed for ${symbol}`,
      data: {
        symbol: tradeData.symbol,
        type: tradeData.type,
        size: tradeData.size,
        timestamp: tradeData.timestamp,
      },
    });
  } catch (error) {
    console.error('Error executing buy cloud:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to execute buy cloud order',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
