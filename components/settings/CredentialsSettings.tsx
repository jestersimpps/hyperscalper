'use client';

import { useState, useEffect } from 'react';
import { useCredentials } from '@/lib/context/credentials-context';
import { privateKeyToAccount } from 'viem/accounts';

interface CredentialsSettingsProps {
  initialWalletAddress?: string | null;
}

export function CredentialsSettings({ initialWalletAddress }: CredentialsSettingsProps = {}) {
  const { credentials, saveCredentials, clearCredentials, updateNetwork } = useCredentials();
  const [privateKey, setPrivateKey] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [isTestnet, setIsTestnet] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [walletAddressError, setWalletAddressError] = useState('');

  useEffect(() => {
    if (credentials) {
      setPrivateKey(credentials.privateKey);
      setWalletAddress(credentials.walletAddress);
      setIsTestnet(credentials.isTestnet);
    } else if (initialWalletAddress) {
      setWalletAddress(initialWalletAddress);
    }
  }, [credentials, initialWalletAddress]);

  const handleSave = async () => {
    try {
      setStatus('saving');
      setErrorMessage('');

      if (!privateKey) {
        throw new Error('Private key is required');
      }

      if (!privateKey.startsWith('0x')) {
        throw new Error('Private key must start with 0x');
      }

      let address = walletAddress;
      if (!address) {
        const account = privateKeyToAccount(privateKey as `0x${string}`);
        address = account.address;
        setWalletAddress(address);
      }

      if (address.startsWith('0x') && address.length === 66) {
        throw new Error('Wallet address cannot be a private key. Please use the Derive button or enter a valid wallet address.');
      }

      await saveCredentials(privateKey, address, isTestnet);
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2000);
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save credentials');
    }
  };

  const handleClear = () => {
    if (confirm('Are you sure you want to clear your credentials? This action cannot be undone.')) {
      clearCredentials();
      setPrivateKey('');
      setWalletAddress('');
      setIsTestnet(false);
      setStatus('idle');
    }
  };

  const handleNetworkChange = async (testnet: boolean) => {
    setIsTestnet(testnet);
    if (credentials) {
      try {
        await updateNetwork(testnet);
        setStatus('success');
        setTimeout(() => setStatus('idle'), 2000);
      } catch (error) {
        setStatus('error');
        setErrorMessage('Failed to update network');
      }
    }
  };

  const handleWalletAddressChange = (value: string) => {
    setWalletAddressError('');

    if (value.startsWith('0x') && value.length === 66) {
      setWalletAddressError('⚠️ This looks like a private key! Do NOT enter your private key here. Use the Private Key field above.');
      return;
    }

    setWalletAddress(value);
  };

  const deriveAddress = () => {
    try {
      if (!privateKey || !privateKey.startsWith('0x')) {
        throw new Error('Invalid private key format');
      }
      const account = privateKeyToAccount(privateKey as `0x${string}`);
      setWalletAddress(account.address);
      setWalletAddressError('');
      setStatus('success');
      setTimeout(() => setStatus('idle'), 1000);
    } catch (error) {
      setStatus('error');
      setErrorMessage('Failed to derive address from private key');
    }
  };

  return (
    <div className="space-y-6 p-6 bg-gray-900 rounded-lg">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Hyperliquid Credentials</h2>
        <p className="text-sm text-gray-400">
          Your credentials are encrypted and stored locally in your browser.
        </p>
      </div>

      <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <svg className="w-5 h-5 text-yellow-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div className="flex-1">
            <h3 className="text-yellow-500 font-semibold mb-1">Security Warning</h3>
            <p className="text-sm text-gray-300">
              Your private key is stored encrypted in your browser. Never share your private key with anyone.
              This app runs entirely in your browser - we never transmit your keys to any server.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Network
          </label>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => handleNetworkChange(false)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                !isTestnet
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              Mainnet
            </button>
            <button
              type="button"
              onClick={() => handleNetworkChange(true)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                isTestnet
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              Testnet
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="privateKey" className="block text-sm font-medium text-gray-300 mb-2">
            Private Key
          </label>
          <div className="relative">
            <input
              id="privateKey"
              type={showKey ? 'text' : 'password'}
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              placeholder="0x..."
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm pr-20"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 text-xs text-gray-400 hover:text-white transition-colors"
            >
              {showKey ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="walletAddress" className="block text-sm font-medium text-gray-300 mb-2">
            Wallet Address
          </label>
          <div className="flex gap-2">
            <input
              id="walletAddress"
              type="text"
              value={walletAddress}
              onChange={(e) => handleWalletAddressChange(e.target.value)}
              placeholder="0x..."
              className={`flex-1 px-4 py-2 bg-gray-800 border rounded-lg text-white focus:outline-none focus:ring-2 font-mono text-sm ${
                walletAddressError
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-700 focus:ring-blue-500'
              }`}
            />
            <button
              type="button"
              onClick={deriveAddress}
              disabled={!privateKey}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded-lg transition-colors text-sm"
            >
              Derive
            </button>
          </div>
          {walletAddressError && (
            <div className="mt-2 bg-red-900/30 border border-red-700/50 rounded-lg p-3">
              <p className="text-sm text-red-400 font-medium">{walletAddressError}</p>
            </div>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-3">
          <p className="text-sm text-red-400">{errorMessage}</p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={status === 'saving' || !privateKey || !!walletAddressError}
          className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg font-medium transition-colors"
        >
          {status === 'saving' ? 'Saving...' : status === 'success' ? 'Saved!' : 'Save Credentials'}
        </button>
        {credentials && (
          <button
            onClick={handleClear}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {credentials && (
        <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-3">
          <p className="text-sm text-green-400">
            ✓ Credentials configured for {credentials.isTestnet ? 'Testnet' : 'Mainnet'}
          </p>
        </div>
      )}
    </div>
  );
}
