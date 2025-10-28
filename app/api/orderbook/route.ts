import { NextRequest, NextResponse } from 'next/server';
import { useSymbolMetaStore } from '@/stores/useSymbolMetaStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const formatPrice = (value: number, decimals: number): string => {
  return parseFloat(value.toFixed(decimals)).toString();
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const coin = searchParams.get('coin') || 'BTC';

  try {
    const isTestnet = process.env.HYPERLIQUID_TESTNET === 'true';
    const apiUrl = isTestnet
      ? 'https://api.hyperliquid-testnet.xyz/info'
      : 'https://api.hyperliquid.xyz/info';

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'l2Book',
        coin
      }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const book = await response.json();
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
