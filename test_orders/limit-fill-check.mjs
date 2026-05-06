// Reproduce the "limit buy below current price fills instantly" bug.
// Sends a Gtc buy at three offsets relative to mid and reports whether
// it rests or fills immediately.
//
// Usage: node test_orders/limit-fill-check.mjs <COIN> [usd]

import { readFileSync } from 'node:fs';
import { PublicClient, WalletClient, HttpTransport, ApiRequestError } from '@nktkas/hyperliquid';
import { privateKeyToAccount } from 'viem/accounts';

function loadEnv() {
  const raw = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
  const out = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}
const env = loadEnv();
const transport = new HttpTransport({ url: 'https://api.hyperliquid.xyz' });
const publicClient = new PublicClient({ transport });
const walletClient = new WalletClient({ wallet: privateKeyToAccount(env.HYPERLIQUID_PRIVATE_KEY), transport, isTestnet: false });
const wallet = env.HYPERLIQUID_WALLET_ADDRESS;

const [, , COIN, usdArg] = process.argv;
if (!COIN) { console.error('Usage: <COIN> [usd]'); process.exit(1); }
const usd = parseFloat(usdArg || '11');

function formatPrice(price, sd) {
  if (price <= 0) return '0';
  const maxDec = Math.max(0, 6 - sd);
  const intDigits = Math.floor(Math.log10(price)) + 1;
  const sigFigDec = Math.max(0, 5 - intDigits);
  const decimals = Math.min(maxDec, sigFigDec);
  const factor = Math.pow(10, decimals);
  return (Math.round(price * factor) / factor).toFixed(decimals);
}
function formatSize(size, sd) { return Math.max(size, Math.pow(10, -sd)).toFixed(sd); }

const meta = await publicClient.meta();
const idx = meta.universe.findIndex(u => u.name === COIN);
const sd = meta.universe[idx].szDecimals;
const book = await publicClient.l2Book({ coin: COIN });
const bid = parseFloat(book.levels[0][0].px);
const ask = parseFloat(book.levels[1][0].px);
const mid = (bid + ask) / 2;
console.log(`${COIN}: bid=${bid} ask=${ask} mid=${mid}`);

// Three test prices: well below ask (should rest), exactly bid, just below ask (should rest), at ask (should fill).
const cases = [
  { label: 'well_below_bid (mid * 0.999)', px: mid * 0.999 },
  { label: 'at_bid', px: bid },
  { label: 'just_below_ask (ask - 1 tick)', px: ask - Math.pow(10, -Math.max(0, 6 - sd)) },
  { label: 'at_ask (marketable)', px: ask },
];

for (const c of cases) {
  const pxStr = formatPrice(c.px, sd);
  const sz = formatSize(usd / c.px, sd);
  const payload = {
    orders: [{ a: idx, b: true, p: pxStr, s: sz, r: false, t: { limit: { tif: 'Gtc' } } }],
    grouping: 'na'
  };
  console.log(`\n[${c.label}] payload: ${JSON.stringify(payload)}`);
  try {
    const res = await walletClient.order(payload);
    const status = res?.response?.data?.statuses?.[0];
    if (status?.filled) {
      console.log(`  → FILLED immediately: ${JSON.stringify(status.filled)}`);
    } else if (status?.resting) {
      console.log(`  → RESTING: oid=${status.resting.oid}`);
      // cancel it
      await new Promise(r => setTimeout(r, 1500));
      try {
        await walletClient.cancel({ cancels: [{ a: idx, o: status.resting.oid }] });
        console.log(`  → cancelled`);
      } catch (e) { console.log(`  → cancel failed: ${e.message}`); }
    } else {
      console.log(`  → other: ${JSON.stringify(status)}`);
    }
  } catch (err) {
    console.log(`  → THREW: ${err.message}`);
  }
  await new Promise(r => setTimeout(r, 4000));
}

// Close any position that opened
const state = await publicClient.clearinghouseState({ user: wallet });
const pos = state.assetPositions.find(p => p.position.coin === COIN);
if (pos) {
  const szi = parseFloat(pos.position.szi);
  console.log(`\nopened position: ${szi} ${COIN}, closing...`);
  const closePx = formatPrice(mid * (szi > 0 ? 0.995 : 1.005), sd);
  const sz = formatSize(Math.abs(szi), sd);
  await walletClient.order({
    orders: [{ a: idx, b: szi < 0, p: closePx, s: sz, r: true, t: { limit: { tif: 'Ioc' } } }],
    grouping: 'na'
  });
  console.log('closed');
}
