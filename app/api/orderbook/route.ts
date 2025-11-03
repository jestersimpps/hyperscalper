import { NextRequest, NextResponse } from 'next/server';
import { useSymbolMetaStore } from '@/stores/useSymbolMetaStore';
import { getHyperliquidService } from '@/lib/services/hyperliquid.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const formatPrice = (value: number, decimals: number): string => {
  return parseFloat(value.toFixed(decimals)).toString();
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const coin = searchParams.get('coin') || 'BTC';
  const nSigFigsParam = searchParams.get('nSigFigs');
  const mantissaParam = searchParams.get('mantissa');

  const nSigFigs = nSigFigsParam ? (parseInt(nSigFigsParam) as 2 | 3 | 4 | 5) : undefined;
  const mantissa = mantissaParam ? (parseInt(mantissaParam) as 2 | 5) : undefined;

  try {
    const service = getHyperliquidService();
    const book = await service.getOrderBook({ coin, nSigFigs, mantissa });
    const decimals = useSymbolMetaStore.getState().getDecimals(coin);

    const bids = book.levels[0].map((level: any) => ({
      price: parseFloat(level.px),
      size: parseFloat(level.sz),
      total: 0
    }));

    const asks = book.levels[1].map((level: any) => ({
      price: parseFloat(level.px),
      size: parseFloat(level.sz),
      total: 0
    }));

    let bidTotal = 0;
    bids.forEach(bid => {
      bidTotal += bid.size;
      bid.total = bidTotal;
    });

    let askTotal = 0;
    asks.forEach(ask => {
      askTotal += ask.size;
      ask.total = askTotal;
    });

    const formattedBook = {
      coin,
      timestamp: Date.now(),
      bids: bids.map(bid => ({
        ...bid,
        priceFormatted: formatPrice(bid.price, decimals.price),
        sizeFormatted: bid.size.toFixed(decimals.size),
        totalFormatted: bid.total.toFixed(decimals.size),
      })),
      asks: asks.map(ask => ({
        ...ask,
        priceFormatted: formatPrice(ask.price, decimals.price),
        sizeFormatted: ask.size.toFixed(decimals.size),
        totalFormatted: ask.total.toFixed(decimals.size),
      }))
    };

    return NextResponse.json(formattedBook);
  } catch (error) {
    console.error('Error fetching order book:', error);
    return NextResponse.json(
      { error: 'Failed to fetch order book' },
      { status: 500 }
    );
  }
}
