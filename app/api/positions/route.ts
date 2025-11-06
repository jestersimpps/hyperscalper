import { NextRequest, NextResponse } from 'next/server';
import { Position } from '@/models/Position';
import { getHyperliquidService } from '@/lib/services/hyperliquid.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function calculatePosition(assetPosition: any, allMids: any): Position {
  const coin = assetPosition.position.coin;
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

  return {
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

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const coin = searchParams.get('coin');

    const service = getHyperliquidService();
    const positions = await service.getOpenPositions();
    const allMids = await service.getAllMids();

    if (coin) {
      const assetPosition = positions.find(p => p.position.coin === coin);
      const position = assetPosition ? calculatePosition(assetPosition, allMids) : null;

      return NextResponse.json({
        success: true,
        position,
      });
    }

    const allPositions = positions.map(assetPosition => calculatePosition(assetPosition, allMids));

    return NextResponse.json({
      success: true,
      positions: allPositions,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
