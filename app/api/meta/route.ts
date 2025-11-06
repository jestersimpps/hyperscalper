import { NextResponse } from 'next/server';
import { getHyperliquidService } from '@/lib/services/hyperliquid.service';

export async function GET() {
  try {
    const service = getHyperliquidService();
    const data = await service.getMeta();

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch symbol metadata' },
      { status: 500 }
    );
  }
}
