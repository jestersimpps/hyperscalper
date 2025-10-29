import { NextRequest, NextResponse } from 'next/server';
import { Order, OrderType, OrderSide } from '@/models/Order';
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
    const allOrders = await service.getOpenOrders();

    console.log(`Raw orders for ${coin}:`, allOrders.filter((o: any) => o.coin === coin));

    const orders: Order[] = allOrders
      .filter((order: any) => order.coin === coin)
      .map((order: any) => {
        // Map Hyperliquid side: 'A' = Ask (Sell), 'B' = Bid (Buy)
        const side = order.side?.toUpperCase() === 'A' ? 'sell' : 'buy';

        // Use origSz (original size at order placement) not sz (remaining size)
        const size = Math.abs(parseFloat(order.origSz || order.sz || '0'));

        // Determine order type from FrontendOrder if available
        let orderType: OrderType = 'limit';
        if (order.orderType) {
          const type = order.orderType.toLowerCase();
          if (type.includes('stop')) orderType = 'stop';
          else if (type.includes('trigger')) orderType = 'trigger';
        } else if (order.triggerPx || order.isTrigger) {
          orderType = 'trigger';
        }

        return {
          oid: order.oid.toString(),
          coin: order.coin,
          side: side as OrderSide,
          price: parseFloat(order.limitPx || order.triggerPx || '0'),
          size,
          orderType,
          timestamp: order.timestamp || Date.now(),
        };
      });

    console.log(`Mapped orders for ${coin}:`, orders);

    return NextResponse.json({
      success: true,
      orders,
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
