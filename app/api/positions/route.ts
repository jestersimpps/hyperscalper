import { NextRequest, NextResponse } from 'next/server';
import { Position } from '@/models/Position';
import { getHyperliquidService } from '@/lib/services/hyperliquid.service';

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

    const service = getHyperliquidService();
    const positions = await service.getOpenPositions();
    const allMids = await service.getAllMids();

    console.log(`All positions:`, positions);
    console.log(`Looking for coin: "${coin}"`);
    console.log(`Available coins in positions:`, positions.map(p => `"${p.position.coin}"`));

    const assetPosition = positions.find(p => p.position.coin === coin);

    if (assetPosition) {
      console.log(`Full assetPosition for ${coin}:`, JSON.stringify(assetPosition, null, 2));
    }

    let position: Position | null = null;

    if (assetPosition) {
      const szi = parseFloat(assetPosition.position.szi);
      const entryPrice = parseFloat(assetPosition.position.entryPx || '0');
      const leverage = parseFloat(assetPosition.position.leverage.value);
      const cumFunding = parseFloat(assetPosition.position.cumFunding?.sinceOpen || '0');

      const currentPrice = parseFloat(allMids[coin] || '0');

      const side: 'long' | 'short' = szi > 0 ? 'long' : 'short';
      const size = Math.abs(szi);

      const positionValue = size * currentPrice;
      const entryValue = size * entryPrice;
      const rawPnl = side === 'long'
        ? positionValue - entryValue
        : entryValue - positionValue;

      const pnl = rawPnl - cumFunding;

      const pnlPercentage = (pnl / entryValue) * 100;

      position = {
        symbol: coin,
        side,
        size,
        entryPrice,
        currentPrice,
        pnl,
        pnlPercentage,
        leverage: Math.floor(leverage),
      };
    }

    console.log(`Position data for ${coin}:`, position);

    return NextResponse.json({
      success: true,
      position,
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
