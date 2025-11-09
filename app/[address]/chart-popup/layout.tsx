'use client';

import { ReactNode } from 'react';

interface ChartPopupLayoutProps {
  children: ReactNode;
}

export default function ChartPopupLayout({ children }: ChartPopupLayoutProps) {
  return (
    <div className="flex flex-col h-screen bg-bg-primary text-primary font-mono">
      {children}
    </div>
  );
}
