'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type { ConnectedAPI, InitialAPI } from '@midnight-ntwrk/dapp-connector-api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WalletState {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  address: string | null;
  connectedApi: ConnectedAPI | null;
  nightBalance: bigint | null;
  dustBalance: bigint | null;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  refreshBalance: () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const WalletContext = createContext<WalletState>({
  status: 'disconnected',
  address: null,
  connectedApi: null,
  nightBalance: null,
  dustBalance: null,
  error: null,
  connect: async () => {},
  disconnect: () => {},
  refreshBalance: async () => {},
});

export function useWallet(): WalletState {
  return useContext(WalletContext);
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function WalletProvider({ children }: { children: ReactNode }) {
  const [status, setStatus]             = useState<WalletState['status']>('disconnected');
  const [address, setAddress]           = useState<string | null>(null);
  const [connectedApi, setConnectedApi] = useState<ConnectedAPI | null>(null);
  const [nightBalance, setNightBalance] = useState<bigint | null>(null);
  const [dustBalance, setDustBalance]   = useState<bigint | null>(null);
  const [error, setError]               = useState<string | null>(null);

  async function readBalances(api: ConnectedAPI) {
    try {
      const [shielded, dust] = await Promise.all([
        api.getShieldedBalances() as Promise<Record<string, bigint>>,
        api.getDustBalance() as Promise<{ balance: bigint; cap: bigint }>,
      ]);
      const nightKey = Object.keys(shielded)[0];
      setNightBalance(nightKey ? (shielded[nightKey] ?? 0n) : 0n);
      setDustBalance(dust.balance ?? 0n);
    } catch {
      // Non-fatal
    }
  }

  const connectInternal = useCallback(async (silent: boolean) => {
    setStatus('connecting');
    setError(null);
    try {
      // Poll for Midnight wallet injection (up to 5 s / 50 × 100 ms).
      // Try `mnLace` first (the known Lace key), then fall back to scanning
      // all keys in window.midnight in case Lace changed its injection key.
      const lace = await (async (): Promise<InitialAPI | undefined> => {
        for (let i = 0; i < 80; i++) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const midnight = (window as any).midnight as Record<string, InitialAPI> | undefined;
          if (midnight) {
            if (midnight.mnLace) return midnight.mnLace;
            // Fallback: pick any injected midnight wallet
            const keys = Object.keys(midnight);
            if (keys.length > 0) return midnight[keys[0]];
          }
          await new Promise(r => setTimeout(r, 100));
        }
        return undefined;
      })();

      if (!lace) throw new Error('LACE_NOT_FOUND');

      const api   = await lace.connect('preprod');
      const addrs = await api.getShieldedAddresses();
      const cfg   = await api.getConfiguration();
      sessionStorage.setItem('kosh:wallet:config', JSON.stringify(cfg));

      setConnectedApi(api);
      setAddress(addrs.shieldedAddress ?? null);
      setStatus('connected');
      sessionStorage.setItem('kosh:wallet:connected', 'true');

      await readBalances(api);
    } catch (err: unknown) {
      sessionStorage.removeItem('kosh:wallet:connected');
      const msg = (err as Error)?.message ?? '';
      if (!silent) {
        if (msg === 'LACE_NOT_FOUND')
          setError('Lace Midnight extension not found. Install it from lace.io, enable it for this site, and make sure Brave shields are off for this domain.');
        else if (msg.includes('reject') || msg.includes('denied') || msg.includes('cancel') || msg.includes('user'))
          setError('Connection rejected. Approve the request in your Lace wallet to continue.');
        else if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('preprod'))
          setError('Wrong network. Switch your Lace wallet to the Midnight Preprod network and try again.');
        else
          setError(msg || 'Failed to connect to Lace.');
        setStatus('error');
      } else {
        setStatus('disconnected');
      }
    }
  }, []);

  const connect = useCallback(() => connectInternal(false), [connectInternal]);

  const disconnect = useCallback(() => {
    setStatus('disconnected');
    setAddress(null);
    setConnectedApi(null);
    setNightBalance(null);
    setDustBalance(null);
    setError(null);
    sessionStorage.removeItem('kosh:wallet:connected');
  }, []);

  const refreshBalance = useCallback(async () => {
    if (connectedApi) await readBalances(connectedApi);
  }, [connectedApi]);

  // Auto-reconnect on mount if previously connected
  useEffect(() => {
    if (sessionStorage.getItem('kosh:wallet:connected') === 'true') {
      void connectInternal(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <WalletContext.Provider value={{ status, address, connectedApi, nightBalance, dustBalance, error, connect, disconnect, refreshBalance }}>
      {children}
    </WalletContext.Provider>
  );
}
