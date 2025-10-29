import { NextRequest, NextResponse } from 'next/server';
import { Position } from '@/models/Position';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const coin = searchParams.get('coin');

    if (!coin) {
      return NextResponse.json(
        { error: 'Missing required parameter: coin' },
        { status: 400 }
      );
    }

    // TODO: Implement actual Hyperliquid position fetching
    // const walletAddress = process.env.HYPERLIQUID_WALLET_ADDRESS;
    // const infoClient = ExchangeFactory.createFromEnv().info;
    // const userState = await infoClient.userState(walletAddress);
    // const position = userState.assetPositions.find(p => p.position.coin === coin);

    // Mock position data for now
    const mockPosition: Position | null = Math.random() > 0.5 ? {
      symbol: coin,
      side: Math.random() > 0.5 ? 'long' : 'short',
      size: Math.random() * 10,
      entryPrice: 95000 + Math.random() * 10000,
      currentPrice: 96000 + Math.random() * 8000,
      pnl: -500 + Math.random() * 2000,
      pnlPercentage: -2 + Math.random() * 6,
      leverage: Math.floor(Math.random() * 10) + 1,
    } : null;

    console.log(`Position data for ${coin}:`, mockPosition);

    return NextResponse.json({
      success: true,
      position: mockPosition,
    });
  } catch (error) {
    console.error('Error fetching position:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
