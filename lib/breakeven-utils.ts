export const calculateBreakevenPrice = (
  entryPrice: number,
  side: 'long' | 'short',
  positionSize: number,
  feeRate: number = 0.001
): number => {
  const entryFee = positionSize * entryPrice * feeRate;
  const entryFeePercentage = feeRate;

  return side === 'long'
    ? entryPrice * (1 + entryFeePercentage) / (1 - entryFeePercentage)
    : entryPrice * (1 - entryFeePercentage) / (1 + entryFeePercentage);
};
