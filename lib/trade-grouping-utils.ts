import type { UserFill } from '@/types';

export interface PositionGroup {
  id: string;
  coin: string;
  side: 'long' | 'short';
  fills: UserFill[];
  entryTime: number;
  exitTime: number;
  averageEntry: number;
  totalQuantity: number;
  totalPnl: number;
  totalFees: number;
}

export const groupFillsByPosition = (fills: UserFill[]): PositionGroup[] => {
  if (fills.length === 0) return [];

  const sortedFills = [...fills].sort((a, b) => a.time - b.time);
  const groups: PositionGroup[] = [];
  const fillsBySymbol: Record<string, UserFill[]> = {};

  sortedFills.forEach(fill => {
    if (!fillsBySymbol[fill.coin]) {
      fillsBySymbol[fill.coin] = [];
    }
    fillsBySymbol[fill.coin].push(fill);
  });

  Object.entries(fillsBySymbol).forEach(([coin, coinFills]) => {
    let currentPosition = 0;
    let currentFills: UserFill[] = [];

    coinFills.forEach((fill, index) => {
      const previousPosition = currentPosition;
      const fillSize = fill.side === 'buy' ? fill.size : -fill.size;
      currentPosition = fill.startPosition + fillSize;

      const isOpening = previousPosition === 0 && currentPosition !== 0;
      const isClosing = currentPosition === 0 && previousPosition !== 0;
      const isExtending = Math.sign(previousPosition) === Math.sign(currentPosition) &&
                          Math.abs(currentPosition) > Math.abs(previousPosition);
      const isReducing = Math.sign(previousPosition) === Math.sign(currentPosition) &&
                         Math.abs(currentPosition) < Math.abs(previousPosition);
      const isReversing = previousPosition !== 0 && currentPosition !== 0 &&
                          Math.sign(previousPosition) !== Math.sign(currentPosition);

      currentFills.push(fill);

      if (isClosing) {
        const group = createPositionGroup(coin, currentFills);
        groups.push(group);
        currentFills = [];
      } else if (isReversing) {
        const group = createPositionGroup(coin, currentFills.slice(0, -1));
        groups.push(group);
        currentFills = [fill];
      }
    });

    if (currentFills.length > 0) {
      const group = createPositionGroup(coin, currentFills);
      groups.push(group);
    }
  });

  return groups.sort((a, b) => b.exitTime - a.exitTime);
};

const createPositionGroup = (coin: string, fills: UserFill[]): PositionGroup => {
  if (fills.length === 0) {
    throw new Error('Cannot create position group from empty fills array');
  }

  const firstFill = fills[0];
  const lastFill = fills[fills.length - 1];

  const side = firstFill.side === 'buy' ? 'long' : 'short';

  let totalWeightedPrice = 0;
  let totalQuantity = 0;
  let totalPnl = 0;
  let totalFees = 0;

  fills.forEach(fill => {
    const isEntry = (side === 'long' && fill.side === 'buy') ||
                    (side === 'short' && fill.side === 'sell');

    if (isEntry) {
      totalWeightedPrice += fill.price * fill.size;
      totalQuantity += fill.size;
    }

    totalPnl += fill.closedPnl;
    totalFees += fill.fee;
  });

  const averageEntry = totalQuantity > 0 ? totalWeightedPrice / totalQuantity : firstFill.price;

  return {
    id: `${coin}-${firstFill.time}-${lastFill.time}`,
    coin,
    side,
    fills,
    entryTime: firstFill.time,
    exitTime: lastFill.time,
    averageEntry,
    totalQuantity,
    totalPnl,
    totalFees
  };
};
