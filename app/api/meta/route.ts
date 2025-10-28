import { NextResponse } from 'next/server';

const API_URL = 'https://api.hyperliquid.xyz/info';

export async function GET() {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'meta',
      }),
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching symbol metadata:', error);
    return NextResponse.json(
      { error: 'Failed to fetch symbol metadata' },
      { status: 500 }
    );
  }
}
