export const calculateBreakevenPrice = (
  entryPrice: number,
  side: 'long' | 'short',
  feeRate: number = 0.001
): number => {
  const totalFeeImpact = 2 * feeRate;
  return side === 'long'
    ? entryPrice * (1 + totalFeeImpact)
    : entryPrice * (1 - totalFeeImpact);
};
