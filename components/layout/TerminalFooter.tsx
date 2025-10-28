interface TerminalFooterProps {
  coin: string;
}

export default function TerminalFooter({ coin }: TerminalFooterProps) {
  return (
    <div className="terminal-border p-1 mt-2">
      <div className="text-[10px] text-primary-muted text-center font-mono tracking-wider">
        █ CONNECTED █ STREAMING █ {coin}/USD █ HYPERLIQUID API █
      </div>
    </div>
  );
}
