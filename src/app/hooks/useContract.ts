'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { CircleLedgerState } from '@/dapp/interact';
import { CircleStatus } from '@/dapp/interact';
import { ENV } from '@/dapp/providers';

export type ProofState =
  | 'idle'
  | 'generating'
  | 'submitting'
  | 'confirmed'
  | 'error';

export interface ContractState {
  ledger: CircleLedgerState | null;
  loading: boolean;
  proofState: ProofState;
  proofElapsedMs: number;
  error: string | null;
  isMember: boolean;
  isMyPayoutRound: boolean;
  myLeafIndex: number | null;

  // Actions
  joinCircle: () => Promise<void>;
  contribute: () => Promise<void>;
  claimPayout: () => Promise<void>;
  reportDefault: (defaulterLeafIndex: number) => Promise<void>;
  generateParticipationProof: () => Promise<string | null>;
  clearError: () => void;
}

/**
 * useContract — manages interaction with a deployed Kosh ROSCA contract.
 *
 * Subscribes to live ledger state via GraphQL WebSocket.
 * Orchestrates proof generation, tx submission, and local state updates.
 *
 * @param contractAddress - The deployed contract address
 * @param walletApi - Connected Lace wallet API
 */
export function useContract(
  contractAddress: string | null,
  walletApi: any | null,
): ContractState {
  const [ledger, setLedger] = useState<CircleLedgerState | null>(null);
  const [loading, setLoading] = useState(false);
  const [proofState, setProofState] = useState<ProofState>('idle');
  const [proofElapsedMs, setProofElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [myLeafIndex, setMyLeafIndex] = useState<number | null>(null);

  const providersRef = useRef<any>(null);
  const contractModuleRef = useRef<any>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Setup providers and subscribe to ledger state ─────────────────────────

  useEffect(() => {
    if (!contractAddress || !walletApi) return;

    // Capture non-null contractAddress for use inside async closures
    const addr = contractAddress;
    let unsubscribe: (() => void) | undefined;

    async function setup() {
      setLoading(true);
      try {
        const { createBrowserProviders } = await import('@/dapp/providers');
        const { subscribeLedgerState } = await import('@/dapp/interact');
        const { loadMemberState } = await import('@/dapp/witnesses');

        // Set up SDK providers (browser-safe, no LevelDB)
        const providers = await createBrowserProviders(walletApi);
        providersRef.current = providers;

        // Load compiled contract module from /build/
        const contractModule = await import('/build/contract/index.js' as any);
        contractModuleRef.current = contractModule;

        // Check if user is already a member
        const state = await loadMemberState(providers.privateStateProvider, addr);
        if (state && state.leafIndex >= 0) {
          setMyLeafIndex(state.leafIndex);
        }

        // Subscribe to live ledger updates
        unsubscribe = subscribeLedgerState(
          providers,
          addr,
          contractModule,
          (newLedger) => {
            setLedger(newLedger);
            setLoading(false);
          },
        );
      } catch (err: any) {
        setError(`Failed to connect to circle: ${err.message}`);
        setLoading(false);
      }
    }

    setup();
    return () => unsubscribe?.();
  }, [contractAddress, walletApi]);

  // ── Proof elapsed timer ───────────────────────────────────────────────────

  function startElapsedTimer() {
    const start = Date.now();
    elapsedTimerRef.current = setInterval(() => {
      setProofElapsedMs(Date.now() - start);
    }, 500);
  }

  function stopElapsedTimer() {
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
  }

  // ── Action factory ────────────────────────────────────────────────────────

  async function runCircuitAction(
    actionName: string,
    action: () => Promise<any>,
  ) {
    if (!providersRef.current || !contractModuleRef.current) {
      setError('Providers not initialized. Try refreshing.');
      return;
    }
    setError(null);
    setProofElapsedMs(0);
    setProofState('generating');
    startElapsedTimer();

    try {
      await action();
      setProofState('confirmed');
      setTimeout(() => setProofState('idle'), 3000);
    } catch (err: any) {
      setError(`${actionName} failed: ${err.message}`);
      setProofState('error');
    } finally {
      stopElapsedTimer();
    }
  }

  // ── Exposed actions ───────────────────────────────────────────────────────

  const joinCircle = useCallback(async () => {
    if (!contractAddress) return;
    await runCircuitAction('Join circle', async () => {
      const { joinCircle: join } = await import('@/dapp/interact');
      const result = await join(
        providersRef.current,
        contractAddress,
        contractModuleRef.current,
      );
      setMyLeafIndex(result.leafIndex);
    });
  }, [contractAddress]);

  const contribute = useCallback(async () => {
    if (!contractAddress) return;
    await runCircuitAction('Contribute', async () => {
      const { contribute: contrib } = await import('@/dapp/interact');
      await contrib(
        providersRef.current,
        contractAddress,
        contractModuleRef.current,
      );
    });
  }, [contractAddress]);

  const claimPayout = useCallback(async () => {
    if (!contractAddress) return;
    await runCircuitAction('Claim payout', async () => {
      const { claimPayout: claim } = await import('@/dapp/interact');
      await claim(
        providersRef.current,
        contractAddress,
        contractModuleRef.current,
      );
    });
  }, [contractAddress]);

  const reportDefault = useCallback(async (defaulterLeafIndex: number) => {
    if (!contractAddress) return;
    await runCircuitAction('Report default', async () => {
      const { reportDefault: report } = await import('@/dapp/interact');
      await report(
        providersRef.current,
        contractAddress,
        contractModuleRef.current,
        defaulterLeafIndex,
      );
    });
  }, [contractAddress]);

  const generateParticipationProof = useCallback(async (): Promise<string | null> => {
    if (!contractAddress) return null;
    let receipt: string | null = null;
    await runCircuitAction('Generate participation proof', async () => {
      const { generateParticipationProof: genProof } = await import('@/dapp/interact');
      const result = await genProof(
        providersRef.current,
        contractAddress,
        contractModuleRef.current,
      );
      receipt = Buffer.from(result.receipt).toString('hex');
    });
    return receipt;
  }, [contractAddress]);

  // ── Derived state ─────────────────────────────────────────────────────────

  const isMember = myLeafIndex !== null && myLeafIndex >= 0;

  const isMyPayoutRound =
    isMember &&
    ledger !== null &&
    myLeafIndex === ledger.currentRound &&
    ledger.circleStatus === CircleStatus.PAYOUT_PENDING;

  return {
    ledger,
    loading,
    proofState,
    proofElapsedMs,
    error,
    isMember,
    isMyPayoutRound,
    myLeafIndex,
    joinCircle,
    contribute,
    claimPayout,
    reportDefault,
    generateParticipationProof,
    clearError: () => setError(null),
  };
}
