import { NextRequest, NextResponse } from 'next/server';
import { ExchangeFactory } from '@/lib/exchange-factory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const coin = searchParams.get('coin') || 'BTC';
  const interval = searchParams.get('interval') || '1m';
  const startTime = searchParams.get('startTime');
  const endTime = searchParams.get('endTime');

  try {
    const exchange = ExchangeFactory.createFromEnv();

    const candles = await exchange.getCandles({
      coin,
      interval,
      startTime: startTime ? parseInt(startTime) : undefined,
      endTime: endTime ? parseInt(endTime) : undefined
    });

    return NextResponse.json(candles);
  } catch (error) {
    console.error('Error fetching candles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch candles' },
      { status: 500 }
    );
  }
}
