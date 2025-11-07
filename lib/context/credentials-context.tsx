'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { encryptData, decryptData, generateDeviceKey } from '@/lib/utils/crypto';

interface Credentials {
  privateKey: string;
  walletAddress: string;
  isTestnet: boolean;
}

interface CredentialsContextType {
  credentials: Credentials | null;
  isLoaded: boolean;
  hasCredentials: boolean;
  saveCredentials: (privateKey: string, walletAddress: string, isTestnet: boolean, password?: string) => Promise<void>;
  loadCredentials: (password?: string) => Promise<boolean>;
  clearCredentials: () => void;
  updateNetwork: (isTestnet: boolean) => Promise<void>;
}

const CredentialsContext = createContext<CredentialsContextType | undefined>(undefined);

const STORAGE_KEY = 'hyperscalper_credentials';
const DEVICE_KEY_STORAGE = 'hyperscalper_device_key';

export function CredentialsProvider({ children }: { children: ReactNode }) {
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    loadCredentials();
  }, []);

  const getDeviceKey = (): string => {
    let deviceKey = localStorage.getItem(DEVICE_KEY_STORAGE);
    if (!deviceKey) {
      deviceKey = generateDeviceKey();
      localStorage.setItem(DEVICE_KEY_STORAGE, deviceKey);
    }
    return deviceKey;
  };

  const saveCredentials = async (
    privateKey: string,
    walletAddress: string,
    isTestnet: boolean,
    password?: string
  ): Promise<void> => {
    const encryptionKey = password || getDeviceKey();

    const data = JSON.stringify({
      privateKey,
      walletAddress,
      isTestnet,
    });

    const encrypted = await encryptData(data, encryptionKey);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(encrypted));

    setCredentials({ privateKey, walletAddress, isTestnet });
  };

  const loadCredentials = async (password?: string): Promise<boolean> => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        setIsLoaded(true);
        return false;
      }

      const encrypted = JSON.parse(stored);
      const encryptionKey = password || getDeviceKey();

      const decrypted = await decryptData(encrypted, encryptionKey);
      const creds = JSON.parse(decrypted) as Credentials;

      setCredentials(creds);
      setIsLoaded(true);
      return true;
    } catch (error) {
      console.error('Failed to load credentials:', error);
      setIsLoaded(true);
      return false;
    }
  };

  const clearCredentials = (): void => {
    localStorage.removeItem(STORAGE_KEY);
    setCredentials(null);
  };

  const updateNetwork = async (isTestnet: boolean): Promise<void> => {
    if (!credentials) {
      throw new Error('No credentials to update');
    }

    await saveCredentials(
      credentials.privateKey,
      credentials.walletAddress,
      isTestnet
    );
  };

  return (
    <CredentialsContext.Provider
      value={{
        credentials,
        isLoaded,
        hasCredentials: credentials !== null,
        saveCredentials,
        loadCredentials,
        clearCredentials,
        updateNetwork,
      }}
    >
      {children}
    </CredentialsContext.Provider>
  );
}

export function useCredentials(): CredentialsContextType {
  const context = useContext(CredentialsContext);
  if (!context) {
    throw new Error('useCredentials must be used within CredentialsProvider');
  }
  return context;
}
