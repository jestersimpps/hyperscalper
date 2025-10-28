'use client';

import { ReactNode } from 'react';

interface AppShellProps {
  sidepanel: ReactNode;
  children: ReactNode;
}

export default function AppShell({ sidepanel, children }: AppShellProps) {
  return (
    <div className="flex h-screen bg-bg-primary text-primary font-mono">
      {/* Sidepanel */}
      <aside className="w-80 border-r-2 border-border-frame overflow-y-auto">
        {sidepanel}
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
