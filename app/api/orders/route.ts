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

    const coinOrders = allOrders.filter((o: any) => o.coin === coin);
    console.log(`Raw orders for ${coin}:`, JSON.stringify(coinOrders, null, 2));

    const orders: Order[] = allOrders
      .filter((order: any) => order.coin === coin)
      .map((order: any) => {
        const side = order.side?.toUpperCase() === 'A' ? 'sell' : 'buy';

        const size = Math.abs(parseFloat(order.origSz || order.sz || '0'));

        let orderType: OrderType = 'limit';
        let price = 0;

        if (order.isTrigger && order.triggerPx) {
          price = parseFloat(order.triggerPx);

          if (order.isPositionTpsl) {
            const ot = order.orderType?.toLowerCase() || '';
            if (ot.includes('stop market') || (order.reduceOnly && !side)) {
              orderType = 'stop';
            } else {
              orderType = 'tp';
            }
          } else if (order.orderType) {
            const ot = order.orderType.toLowerCase();
            if (ot.includes('stop')) {
              orderType = 'stop';
            } else {
              orderType = 'trigger';
            }
          } else {
            orderType = 'trigger';
          }
        } else {
          price = parseFloat(order.limitPx || '0');
          orderType = 'limit';
        }

        return {
          oid: order.oid.toString(),
          coin: order.coin,
          side: side as OrderSide,
          price,
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
