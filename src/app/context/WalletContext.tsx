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
      // Poll for Lace Midnight injection (up to 3 s / 30 × 100 ms)
      const lace = await (async (): Promise<InitialAPI | undefined> => {
        for (let i = 0; i < 30; i++) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const found = (window as any).midnight?.mnLace as InitialAPI | undefined;
          if (found) return found;
          await new Promise(r => setTimeout(r, 100));
        }
        return undefined;
      })();

      if (!lace) throw new Error('LACE_NOT_FOUND');

      const api   = await lace.connect('preview');
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
        if (msg === 'LACE_NOT_FOUND' || msg.includes('inject') || msg.includes('undefined'))
          setError('Lace not detected. Make sure the Lace extension is enabled and its network is set to "Preview".');
        else if (msg.includes('reject') || msg.includes('denied') || msg.includes('cancel'))
          setError('Connection rejected in Lace.');
        else
          setError(msg || 'Failed to connect.');
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
