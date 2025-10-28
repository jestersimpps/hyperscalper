import { InfoClient, HttpTransport } from '@nktkas/hyperliquid';

const client = new InfoClient({ 
  transport: new HttpTransport({ url: 'https://api.hyperliquid.xyz/info' }) 
});

try {
  const result = await client.candleSnapshot({ coin: 'BTC', interval: '1m' });
  console.log('Success! Got', result.length, 'candles');
  if (result.length > 0) {
    console.log('First candle:', JSON.stringify(result[0]));
  }
} catch (error) {
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
}
