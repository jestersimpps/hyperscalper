'use client';

interface SignalLegendItem {
  color: string;
  label: string;
  description: string;
  shape?: 'circle' | 'line';
}

interface ChartLegendProps {
  className?: string;
}

const SIGNAL_COLORS = {
  ema: '#00D9FF',
  macd: '#FF6B35',
  rsi: '#FFD700',
  divergence: '#9D4EDD',
  hiddenDivergence: '#00FF7F',
  pivot: '#888888',
  breakeven: '#FFFF00',
};

const LEGEND_ITEMS: SignalLegendItem[] = [
  { color: SIGNAL_COLORS.ema, label: 'EMA', description: 'EMA Alignment (above/below bar = bullish/bearish)', shape: 'circle' },
  { color: SIGNAL_COLORS.macd, label: 'MACD', description: 'MACD Crossover (above/below bar = bearish/bullish)', shape: 'circle' },
  { color: SIGNAL_COLORS.rsi, label: 'RSI', description: 'RSI Reversal (above/below bar = bearish/bullish)', shape: 'circle' },
  { color: SIGNAL_COLORS.divergence, label: 'Div', description: 'Stochastic Divergence (above/below bar = bearish/bullish)', shape: 'circle' },
  { color: SIGNAL_COLORS.hiddenDivergence, label: 'H-Div', description: 'Hidden Divergence (above/below bar = bearish/bullish)', shape: 'circle' },
  { color: SIGNAL_COLORS.pivot, label: 'Pivot', description: 'Price Pivot Points', shape: 'circle' },
  { color: SIGNAL_COLORS.breakeven, label: 'Breakeven', description: 'Fee zone - price must move beyond this to profit', shape: 'line' },
];

export default function ChartLegend({ className = '' }: ChartLegendProps) {
  return (
    <div className={`text-[9px] flex items-center gap-3 ${className}`}>
      {LEGEND_ITEMS.map((item, index) => (
        <div key={index} className="flex items-center gap-1" title={item.description}>
          {item.shape === 'line' ? (
            <div
              className="w-4 h-[3px] flex-shrink-0"
              style={{ backgroundColor: item.color }}
            />
          ) : (
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: item.color }}
            />
          )}
          <span className="text-primary whitespace-nowrap">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
