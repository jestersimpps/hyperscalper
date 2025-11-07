'use client';

import { ReactNode } from 'react';
import { useCredentials } from '@/lib/context/credentials-context';
import { CredentialsSettings } from '@/components/settings/CredentialsSettings';

interface RequireCredentialsProps {
  children: ReactNode;
}

export function RequireCredentials({ children }: RequireCredentialsProps) {
  const { hasCredentials, isLoaded } = useCredentials();

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading credentials...</p>
        </div>
      </div>
    );
  }

  if (!hasCredentials) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950 p-6">
        <div className="max-w-2xl w-full">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">Welcome to HyperScalper</h1>
            <p className="text-gray-400">
              Configure your Hyperliquid credentials to get started
            </p>
          </div>
          <CredentialsSettings />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
