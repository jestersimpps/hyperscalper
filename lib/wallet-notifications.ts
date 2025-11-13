import toast from 'react-hot-toast';
import type { AssetPosition, FrontendOrder } from '@nktkas/hyperliquid';

const formatAddress = (address: string) => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export function notifyNewPosition(
  walletAddress: string,
  walletNickname: string | undefined,
  position: AssetPosition
) {
  const displayName = walletNickname || formatAddress(walletAddress);
  const szi = parseFloat(position.position.szi);
  const side = szi > 0 ? 'LONG' : 'SHORT';
  const size = Math.abs(szi);
  const entryPx = parseFloat(position.position.entryPx);

  toast.success(
    `${displayName} opened ${side} ${position.position.coin}\nSize: ${size.toFixed(4)} @ $${entryPx.toFixed(2)}`,
    {
      duration: 6000,
      icon: '📈',
    }
  );
}

export function notifyClosedPosition(
  walletAddress: string,
  walletNickname: string | undefined,
  position: AssetPosition
) {
  const displayName = walletNickname || formatAddress(walletAddress);
  const szi = parseFloat(position.position.szi);
  const side = szi > 0 ? 'LONG' : 'SHORT';
  const unrealizedPnl = parseFloat(position.position.unrealizedPnl);
  const pnlColor = unrealizedPnl > 0 ? '🟢' : unrealizedPnl < 0 ? '🔴' : '⚪';

  toast(
    `${displayName} closed ${side} ${position.position.coin}\nP&L: ${pnlColor} $${unrealizedPnl.toFixed(2)}`,
    {
      duration: 6000,
      icon: '📉',
      style: {
        background: '#1a1a1a',
        color: unrealizedPnl > 0 ? '#00ff00' : unrealizedPnl < 0 ? '#ff0000' : '#00ff00',
        border: '1px solid #00ff00',
        fontFamily: 'monospace',
        fontSize: '12px',
      },
    }
  );
}

export function notifyReducedPosition(
  walletAddress: string,
  walletNickname: string | undefined,
  coin: string,
  previousSize: number,
  newSize: number,
  side: 'long' | 'short'
) {
  const displayName = walletNickname || formatAddress(walletAddress);
  const reduced = Math.abs(previousSize - newSize);

  toast(
    `${displayName} reduced ${side.toUpperCase()} ${coin}\nReduced by: ${reduced.toFixed(4)}`,
    {
      duration: 6000,
      icon: '📊',
    }
  );
}

export function notifyNewOrder(
  walletAddress: string,
  walletNickname: string | undefined,
  order: FrontendOrder
) {
  const displayName = walletNickname || formatAddress(walletAddress);
  const side = order.side === 'A' ? 'SELL' : 'BUY';
  const size = Math.abs(parseFloat(order.origSz || order.sz || '0'));
  const price = order.isTrigger ? parseFloat(order.triggerPx || '0') : parseFloat(order.limitPx || '0');

  toast(
    `${displayName} placed ${side} order ${order.coin}\nSize: ${size.toFixed(4)} @ $${price.toFixed(2)}`,
    {
      duration: 6000,
      icon: '📝',
    }
  );
}

export function notifyRemovedOrder(
  walletAddress: string,
  walletNickname: string | undefined,
  order: FrontendOrder
) {
  const displayName = walletNickname || formatAddress(walletAddress);
  const side = order.side === 'A' ? 'SELL' : 'BUY';
  const size = Math.abs(parseFloat(order.origSz || order.sz || '0'));
  const price = order.isTrigger ? parseFloat(order.triggerPx || '0') : parseFloat(order.limitPx || '0');

  toast(
    `${displayName} cancelled ${side} order ${order.coin}\nSize: ${size.toFixed(4)} @ $${price.toFixed(2)}`,
    {
      duration: 6000,
      icon: '❌',
    }
  );
}
