'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type { ConnectedAPI, InitialAPI, APIError } from '@midnight-ntwrk/dapp-connector-api';
import { ErrorCodes } from '@midnight-ntwrk/dapp-connector-api';

function isAPIError(err: unknown): err is APIError {
  return typeof err === 'object' && err !== null && (err as any).type === 'DAppConnectorAPIError';
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WalletState {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  /** Unshielded address — what Lace displays as "Wallet address" (mn_addr_preprod1…) */
  address: string | null;
  /** Shielded address — the ZK identity address (mn_shield-addr_preprod1…) */
  shieldedAddress: string | null;
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
  shieldedAddress: null,
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
  const [status, setStatus]                   = useState<WalletState['status']>('disconnected');
  const [address, setAddress]                 = useState<string | null>(null);
  const [shieldedAddress, setShieldedAddress] = useState<string | null>(null);
  const [connectedApi, setConnectedApi]       = useState<ConnectedAPI | null>(null);
  const [nightBalance, setNightBalance]       = useState<bigint | null>(null);
  const [dustBalance, setDustBalance]         = useState<bigint | null>(null);
  const [error, setError]                     = useState<string | null>(null);

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

      const api = await lace.connect('preprod');

      // Fetch both address types and wallet config in parallel
      const [addrs, unshielded, cfg] = await Promise.all([
        api.getShieldedAddresses(),
        api.getUnshieldedAddress(),
        api.getConfiguration(),
      ]);

      sessionStorage.setItem('kosh:wallet:config', JSON.stringify(cfg));
      // Persist display address so auto-reconnect restores it without re-calling the API
      sessionStorage.setItem('kosh:wallet:address', unshielded.unshieldedAddress ?? '');
      sessionStorage.setItem('kosh:wallet:shielded', addrs.shieldedAddress ?? '');

      setConnectedApi(api);
      setAddress(unshielded.unshieldedAddress ?? null);
      setShieldedAddress(addrs.shieldedCoinPublicKey ?? null);
      setStatus('connected');
      sessionStorage.setItem('kosh:wallet:connected', 'true');

      await readBalances(api);
    } catch (err: unknown) {
      sessionStorage.removeItem('kosh:wallet:connected');
      if (!silent) {
        if (isAPIError(err)) {
          const { code, reason } = err;
          if (code === ErrorCodes.Rejected || code === ErrorCodes.PermissionRejected)
            setError('Connection rejected. Approve the request in your Lace wallet to continue.');
          else if (code === ErrorCodes.InvalidRequest)
            setError(`Invalid request: ${reason}. Make sure your Lace wallet is on the Midnight Preprod network.`);
          else if (code === ErrorCodes.Disconnected)
            setError('Wallet disconnected. Unlock your Lace wallet and try again.');
          else
            setError(reason || err.message || 'Lace wallet error. Try again.');
        } else {
          const msg = (err as Error)?.message ?? '';
          if (msg === 'LACE_NOT_FOUND')
            setError('Lace Midnight extension not found. Install it from lace.io, enable it for this site, and make sure Brave shields are off for this domain.');
          else if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('preprod'))
            setError('Wrong network. Switch your Lace wallet to the Midnight Preprod network and try again.');
          else
            setError(msg || 'Failed to connect to Lace.');
        }
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
    setShieldedAddress(null);
    setConnectedApi(null);
    setNightBalance(null);
    setDustBalance(null);
    setError(null);
    sessionStorage.removeItem('kosh:wallet:connected');
    sessionStorage.removeItem('kosh:wallet:address');
    sessionStorage.removeItem('kosh:wallet:shielded');
  }, []);

  const refreshBalance = useCallback(async () => {
    if (connectedApi) await readBalances(connectedApi);
  }, [connectedApi]);

  // Auto-reconnect on mount if previously connected.
  // Restore cached addresses immediately so the UI isn't blank during the silent reconnect.
  useEffect(() => {
    if (sessionStorage.getItem('kosh:wallet:connected') === 'true') {
      const cached          = sessionStorage.getItem('kosh:wallet:address');
      const cachedShielded  = sessionStorage.getItem('kosh:wallet:shielded');
      if (cached)         setAddress(cached);
      if (cachedShielded) setShieldedAddress(cachedShielded);
      void connectInternal(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <WalletContext.Provider value={{ status, address, shieldedAddress, connectedApi, nightBalance, dustBalance, error, connect, disconnect, refreshBalance }}>
      {children}
    </WalletContext.Provider>
  );
}
