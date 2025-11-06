import { NextResponse } from 'next/server';

interface SymbolWithVolume {
  name: string;
  volume: number;
}

export async function GET() {
  try {
    const API_URL = 'https://api.hyperliquid.xyz/info';
    const metaResponse = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
    });

    if (!metaResponse.ok) {
      throw new Error('Failed to fetch symbol metadata');
    }

    const [metaData, assetCtxs] = await metaResponse.json();

    const symbolsWithVolume: SymbolWithVolume[] = metaData.universe
      .map((u: any, index: number) => ({
        name: u.name,
        volume: parseFloat(assetCtxs[index]?.dayNtlVlm || '0'),
        isDelisted: u.isDelisted,
      }))
      .filter((s: any) => !s.isDelisted)
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 20);

    return NextResponse.json(symbolsWithVolume);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch top symbols' },
      { status: 500 }
    );
  }
}
