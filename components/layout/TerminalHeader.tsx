interface TerminalHeaderProps {
  coin: string;
}

export default function TerminalHeader({ coin }: TerminalHeaderProps) {
  return (
    <div className="terminal-border p-1.5 mb-2">
      <div className="flex justify-between items-center">
        <div className="terminal-text">
          <span className="text-primary text-sm font-bold tracking-wider">█ HYPERLIQUID TERMINAL</span>
          <span className="ml-3 text-primary-muted text-[10px]">v1.0.0</span>
        </div>
        <div className="text-right text-[10px]">
          <div className="text-primary font-bold">{coin}/USD</div>
          <div className="text-primary-muted">{new Date().toLocaleString()}</div>
        </div>
      </div>
    </div>
  );
}
