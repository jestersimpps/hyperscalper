'use client';

interface SignalLegendItem {
  color: string;
  label: string;
  description: string;
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
};

const LEGEND_ITEMS: SignalLegendItem[] = [
  { color: SIGNAL_COLORS.ema, label: 'EMA', description: 'EMA Alignment (above/below bar = bullish/bearish)' },
  { color: SIGNAL_COLORS.macd, label: 'MACD', description: 'MACD Crossover (above/below bar = bearish/bullish)' },
  { color: SIGNAL_COLORS.rsi, label: 'RSI', description: 'RSI Reversal (above/below bar = bearish/bullish)' },
  { color: SIGNAL_COLORS.divergence, label: 'Divergence', description: 'Stochastic Divergence (above/below bar = bearish/bullish)' },
  { color: SIGNAL_COLORS.hiddenDivergence, label: 'Hidden Div', description: 'Hidden Divergence (above/below bar = bearish/bullish)' },
  { color: SIGNAL_COLORS.pivot, label: 'Pivot', description: 'Price Pivot Points' },
];

export default function ChartLegend({ className = '' }: ChartLegendProps) {
  return (
    <div className={`text-[9px] ${className}`}>
      <div className="text-primary-muted mb-1 uppercase tracking-wider">Signal Legend</div>
      <div className="flex gap-4 flex-wrap">
        {LEGEND_ITEMS.map((item, index) => (
          <div key={index} className="flex items-center gap-1.5" title={item.description}>
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-primary">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
