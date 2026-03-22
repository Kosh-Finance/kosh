'use client';

import { useState, useEffect, useCallback } from 'react';

export type WalletStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'wrong-network'
  | 'error';

export interface WalletState {
  status: WalletStatus;
  address: string | null;
  nightBalance: bigint | null;
  dustBalance: bigint | null;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  refreshBalance: () => Promise<void>;
}

/**
 * useWallet — Lace wallet connection via DApp Connector API.
 *
 * Handles:
 *   - Lace extension detection
 *   - Network validation (must be "Undeployed" for local dev)
 *   - NIGHT + DUST balance reading
 *   - Auto-reconnect on page reload if previously connected
 */
export function useWallet(): WalletState {
  const [status, setStatus] = useState<WalletStatus>('disconnected');
  const [address, setAddress] = useState<string | null>(null);
  const [nightBalance, setNightBalance] = useState<bigint | null>(null);
  const [dustBalance, setDustBalance] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [api, setApi] = useState<any>(null);

  // Try to restore connection on mount (Lace auto-reconnects if already authorized)
  useEffect(() => {
    const wasConnected = sessionStorage.getItem('kosh:wallet:connected');
    if (wasConnected === 'true') {
      connect();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const connect = useCallback(async () => {
    setStatus('connecting');
    setError(null);

    try {
      // Lace injects its DApp Connector API under window.midnight.mnLace
      // The InitialAPI.connect(networkId) returns a ConnectedAPI
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const midnightObj = (typeof window !== 'undefined' ? (window as any).midnight : undefined) as
        Record<string, import('@midnight-ntwrk/dapp-connector-api').InitialAPI> | undefined;

      const laceApi = midnightObj?.mnLace;
      if (!laceApi) {
        throw new Error('Lace wallet not detected. Install the Lace extension for Chrome.');
      }

      // Request connection — networkId 'undeployed' targets local dev environment
      const connectedApi = await laceApi.connect('undeployed');

      setApi(connectedApi);
      setStatus('connected');
      sessionStorage.setItem('kosh:wallet:connected', 'true');

      // Read address and balances
      const addresses = await connectedApi.getShieldedAddresses();
      setAddress(addresses.shieldedAddress ?? null);

      await readBalances(connectedApi);
    } catch (err: any) {
      sessionStorage.removeItem('kosh:wallet:connected');
      const msg = err?.message ?? String(err);

      if (msg.includes('not found') || msg.includes('inject') || msg.includes('undefined')) {
        setError('Lace wallet not detected. Install the Lace extension for Chrome.');
      } else if (msg.includes('rejected') || msg.includes('denied') || msg.includes('user')) {
        setError('Connection rejected. Approve the request in Lace to continue.');
      } else {
        setError(msg);
      }
      setStatus('error');
    }
  }, []);

  const disconnect = useCallback(() => {
    setApi(null);
    setStatus('disconnected');
    setAddress(null);
    setNightBalance(null);
    setDustBalance(null);
    setError(null);
    sessionStorage.removeItem('kosh:wallet:connected');
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!api) return;
    await readBalances(api);
  }, [api]);

  async function readBalances(connectedApi: any) {
    try {
      // NIGHT is a shielded token; DUST is non-transferable gas
      const [shielded, dust] = await Promise.all([
        connectedApi.getShieldedBalances() as Promise<Record<string, bigint>>,
        connectedApi.getDustBalance() as Promise<{ balance: bigint; cap: bigint }>,
      ]);
      // NIGHT token type key — the record is keyed by token type identifier
      const nightKey = Object.keys(shielded)[0];
      setNightBalance(nightKey ? (shielded[nightKey] ?? 0n) : 0n);
      setDustBalance(dust.balance ?? 0n);
    } catch {
      // Non-fatal — balances can be read again later
    }
  }

  return {
    status,
    address,
    nightBalance,
    dustBalance,
    error,
    connect,
    disconnect,
    refreshBalance,
  };
}

/**
 * Format a NIGHT balance for display.
 * 1 NIGHT = 1,000,000 base units
 */
export function formatNight(amount: bigint | null): string {
  if (amount === null) return '—';
  const whole = amount / 1_000_000n;
  const frac  = amount % 1_000_000n;
  if (frac === 0n) return `${whole} NIGHT`;
  const fracStr = String(frac).padStart(6, '0').replace(/0+$/, '');
  return `${whole}.${fracStr} NIGHT`;
}

/**
 * Format a contract address for display (truncated).
 */
export function formatAddress(address: string | null, chars = 8): string {
  if (!address) return '—';
  return `${address.slice(0, chars)}…${address.slice(-4)}`;
}
