export function getInvertedColorClass(normalClass: string, invertedMode: boolean): string {
  if (!invertedMode) return normalClass;

  const colorMap: Record<string, string> = {
    'text-bullish': 'text-bearish',
    'text-bearish': 'text-bullish',
    'bg-bullish': 'bg-bearish',
    'bg-bearish': 'bg-bullish',
    'border-bullish': 'border-bearish',
    'border-bearish': 'border-bullish',
    'from-bullish': 'from-bearish',
    'from-bearish': 'from-bullish',
    'to-bullish': 'to-bearish',
    'to-bearish': 'to-bullish',
  };

  return colorMap[normalClass] || normalClass;
}

export function getInvertedAnimationClass(normalClass: string, invertedMode: boolean): string {
  if (!invertedMode) return normalClass;

  const animationMap: Record<string, string> = {
    'animate-blink-green': 'animate-blink-red',
    'animate-blink-red': 'animate-blink-green',
    'animate-highlight-new-long': 'animate-highlight-new-short',
    'animate-highlight-new-short': 'animate-highlight-new-long',
  };

  return animationMap[normalClass] || normalClass;
}

export function getInvertedSide(side: 'long' | 'short' | 'LONG' | 'SHORT', invertedMode: boolean): string {
  if (!invertedMode) return side;

  const sideMap: Record<string, string> = {
    'long': 'short',
    'short': 'long',
    'LONG': 'SHORT',
    'SHORT': 'LONG',
  };

  return sideMap[side] || side;
}

export function getInvertedOrderSide(side: 'buy' | 'sell' | 'BUY' | 'SELL', invertedMode: boolean): string {
  if (!invertedMode) return side;

  const sideMap: Record<string, string> = {
    'buy': 'sell',
    'sell': 'buy',
    'BUY': 'SELL',
    'SELL': 'BUY',
  };

  return sideMap[side] || side;
}

export function getInvertedSignalType(signalType: 'bullish' | 'bearish', invertedMode: boolean): 'bullish' | 'bearish' {
  if (!invertedMode) return signalType;
  return signalType === 'bullish' ? 'bearish' : 'bullish';
}

export function getInvertedArrow(arrow: '▲' | '▼', invertedMode: boolean): '▲' | '▼' {
  if (!invertedMode) return arrow;
  return arrow === '▲' ? '▼' : '▲';
}

export function getInvertedSupportResistance(
  type: 'support' | 'resistance',
  invertedMode: boolean
): 'support' | 'resistance' {
  if (!invertedMode) return type;
  return type === 'support' ? 'resistance' : 'support';
}

export function shouldInvertCondition(condition: boolean, invertedMode: boolean): boolean {
  return invertedMode ? !condition : condition;
}
