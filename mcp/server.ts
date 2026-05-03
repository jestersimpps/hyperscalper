import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { PublicClient, HttpTransport, type AssetPosition } from '@nktkas/hyperliquid';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';

loadEnv({ path: resolve(process.cwd(), '.env.local') });
loadEnv({ path: resolve(process.cwd(), '.env') });

interface PositionView {
  coin: string;
  side: 'long' | 'short';
  size: string;
  entryPrice: string;
  liquidationPrice: string | null;
  unrealizedPnl: string;
  marginUsed: string;
  leverage: { type: string; value: number };
}

const isTestnet = process.env.HYPERLIQUID_TESTNET === 'true' || process.env.EXCHANGE_TESTNET === 'true';
const walletAddress = process.env.HYPERLIQUID_WALLET_ADDRESS;

const httpUrl = isTestnet ? 'https://api.hyperliquid-testnet.xyz' : 'https://api.hyperliquid.xyz';
const publicClient = new PublicClient({ transport: new HttpTransport({ url: httpUrl }) });

function viewPosition(p: AssetPosition): PositionView {
  const sizeNum = parseFloat(p.position.szi);
  return {
    coin: p.position.coin,
    side: sizeNum >= 0 ? 'long' : 'short',
    size: Math.abs(sizeNum).toString(),
    entryPrice: p.position.entryPx ?? '0',
    liquidationPrice: p.position.liquidationPx ?? null,
    unrealizedPnl: p.position.unrealizedPnl,
    marginUsed: p.position.marginUsed,
    leverage: {
      type: p.position.leverage.type,
      value: p.position.leverage.value
    }
  };
}

async function getPositions(user?: string): Promise<PositionView[]> {
  const address = (user || walletAddress) as `0x${string}` | undefined;
  if (!address) {
    throw new Error('No wallet address. Pass `user` arg or set HYPERLIQUID_WALLET_ADDRESS in .env.local.');
  }
  const state = await publicClient.clearinghouseState({ user: address });
  return state.assetPositions
    .filter(p => parseFloat(p.position.szi) !== 0)
    .map(viewPosition);
}

const server = new Server(
  { name: 'hyperscalper', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'get_positions',
      description:
        'Returns the current open perp positions for the configured wallet on Hyperliquid. Read-only — does not place or modify any orders.',
      inputSchema: {
        type: 'object',
        properties: {
          user: {
            type: 'string',
            description: 'Optional wallet address (0x…). Defaults to HYPERLIQUID_WALLET_ADDRESS from .env.local.'
          }
        },
        additionalProperties: false
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'get_positions') {
    const user = typeof args?.user === 'string' ? args.user : undefined;
    const positions = await getPositions(user);
    return {
      content: [
        {
          type: 'text',
          text:
            positions.length === 0
              ? 'No open positions.'
              : JSON.stringify(positions, null, 2)
        }
      ]
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err: unknown) => {
  console.error('[hyperscalper-mcp] fatal:', err);
  process.exit(1);
});
