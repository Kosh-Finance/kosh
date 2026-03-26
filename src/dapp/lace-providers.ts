/**
 * Kosh — Browser Provider Implementations
 *
 * Provides all six MidnightProviders needed by midnight-js-contracts for
 * browser-based contract deployment via the Lace wallet (ConnectedAPI).
 *
 * Provider implementations:
 *   - InMemoryPrivateStateProvider  — Map-backed, no LevelDB needed
 *   - BrowserZkConfigProvider       — fetches ZK keys via fetch() from /build/
 *   - BrowserPublicDataProvider     — polls indexer GraphQL for tx finalization
 *   - BrowserProofProvider          — delegates proving to Lace via getProvingProvider()
 *   - walletProvider                — Lace balance + key adapter
 *   - midnightProvider              — Lace submit adapter
 */

import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

// ─── InMemoryPrivateStateProvider ────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function makeInMemoryPrivateStateProvider(): any {
  let currentAddress: string | null = null;
  const states = new Map<string, unknown>();
  const signingKeys = new Map<string, unknown>();

  const scopeKey = (id: string) => `${currentAddress ?? '_'}:${id}`;

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setContractAddress(address: any) {
      currentAddress = String(address);
    },
    async set(id: string, state: unknown) {
      states.set(scopeKey(id), state);
    },
    async get(id: string) {
      return states.get(scopeKey(id)) ?? null;
    },
    async remove(id: string) {
      states.delete(scopeKey(id));
    },
    async clear() {
      const prefix = `${currentAddress ?? '_'}:`;
      for (const key of states.keys()) {
        if (key.startsWith(prefix)) states.delete(key);
      }
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async setSigningKey(address: any, signingKey: unknown) {
      signingKeys.set(String(address), signingKey);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async getSigningKey(address: any) {
      return signingKeys.get(String(address)) ?? null;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async removeSigningKey(address: any) {
      signingKeys.delete(String(address));
    },
    async clearSigningKeys() {
      signingKeys.clear();
    },
    async exportPrivateStates(): Promise<never> {
      throw new Error('exportPrivateStates not supported in browser');
    },
    async importPrivateStates(): Promise<never> {
      throw new Error('importPrivateStates not supported in browser');
    },
  };
}

// ─── BrowserZkConfigProvider ─────────────────────────────────────────────────

/**
 * Fetches ZK artifacts from Next.js static assets served from /build/.
 * Only getVerifierKey and getZKIR are needed for the deploy flow;
 * getProverKey is used by BrowserProofProvider via the keyMaterialProvider
 * passed to Lace's getProvingProvider.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function makeBrowserZkConfigProvider(buildPath = '/build'): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const provider: any = {
    async getZKIR(circuitId: string) {
      return fetchBytes(`${buildPath}/zkir/${circuitId}.bzkir`);
    },
    async getProverKey(circuitId: string) {
      return fetchBytes(`${buildPath}/keys/${circuitId}.prover`);
    },
    async getVerifierKey(circuitId: string) {
      return fetchBytes(`${buildPath}/keys/${circuitId}.verifier`);
    },
    // Non-abstract convenience method — must be implemented on the duck-typed object
    // since we don't extend ZKConfigProvider's abstract class directly.
    async getVerifierKeys(circuitIds: string[]) {
      return Promise.all(
        circuitIds.map(async (id) => [id, await provider.getVerifierKey(id)] as const),
      );
    },
    async get(circuitId: string) {
      const [proverKey, verifierKey, zkir] = await Promise.all([
        provider.getProverKey(circuitId),
        provider.getVerifierKey(circuitId),
        provider.getZKIR(circuitId),
      ]);
      return { circuitId, proverKey, verifierKey, zkir };
    },
  };
  return provider;
}

// ─── BrowserPublicDataProvider ───────────────────────────────────────────────

/**
 * Implements watchForTxData by polling the Midnight indexer GraphQL API.
 * Only watchForTxData is needed for the deploy flow.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function makeBrowserPublicDataProvider(indexerUrl: string): any {
  const POLL_INTERVAL_MS = 2000;
  const MAX_POLLS = 150; // ~5 minutes

  async function queryTxStatus(txId: string) {
    const res = await fetch(indexerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query TransactionStatus($transactionId: HexEncoded!) {
          transactions(offset: {identifier: $transactionId}) {
            ... on RegularTransaction {
              identifiers
              transactionResult {
                status
              }
            }
          }
        }`,
        variables: { transactionId: txId },
      }),
    });
    if (!res.ok) throw new Error(`Indexer query failed: ${res.status}`);
    const json = await res.json();
    return json?.data?.transactions?.[0] ?? null;
  }

  return {
    async watchForTxData(txId: string) {
      for (let i = 0; i < MAX_POLLS; i++) {
        const tx = await queryTxStatus(txId);
        if (tx) {
          const raw = tx.transactionResult?.status as string | undefined;
          const status =
            raw === 'SUCCESS'         ? 'SucceedEntirely' :
            raw === 'PARTIAL_SUCCESS' ? 'FailFallible'    : 'FailEntirely';
          return {
            status,
            txId,
            identifiers: (tx.identifiers as string[] | undefined) ?? [txId],
          };
        }
        await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
      throw new Error(
        `Transaction ${txId} not confirmed after ${(MAX_POLLS * POLL_INTERVAL_MS) / 1000}s`,
      );
    },

    // Stubs — not needed for the deploy flow
    async watchForDeployTxData(_contractAddress: string): Promise<never> {
      throw new Error('watchForDeployTxData not implemented for browser');
    },
    async queryContractState(_contractAddress: string) {
      return null;
    },
    async queryZSwapAndContractState(): Promise<never> {
      throw new Error('queryZSwapAndContractState not implemented for browser');
    },
    async queryDeployContractState(): Promise<never> {
      throw new Error('queryDeployContractState not implemented for browser');
    },
    async watchForContractState(): Promise<never> {
      throw new Error('watchForContractState not implemented for browser');
    },
    contractStateObservable(): never {
      throw new Error('contractStateObservable not implemented for browser');
    },
    async watchForTxData_stub(): Promise<never> {
      throw new Error('watchForTxData not implemented for browser');
    },
  };
}

// ─── BrowserProofProvider ────────────────────────────────────────────────────

/**
 * Delegates ZK proving to Lace via getProvingProvider(keyMaterialProvider).
 *
 * Lace fetches the prover keys from our keyMaterialProvider (which serves them
 * from /build/keys/) and handles the actual proving (either in-browser WASM
 * or via Lace's own proof server, depending on wallet configuration).
 *
 * CostModel.initialCostModel() is imported from ledger-v7 at call time.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function makeBrowserProofProvider(api: ConnectedAPI, buildPath = '/build'): any {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async proveTx(unprovenTx: any) {
      // Provide ZK key material to Lace — Lace calls these to fetch keys for proving.
      const keyMaterialProvider = {
        getZKIR:       (id: string) => fetchBytes(`${buildPath}/zkir/${id}.bzkir`),
        getProverKey:  (id: string) => fetchBytes(`${buildPath}/keys/${id}.prover`),
        getVerifierKey:(id: string) => fetchBytes(`${buildPath}/keys/${id}.verifier`),
      };

      const laceProvider = await api.getProvingProvider(keyMaterialProvider);

      // CostModel must be a WASM CostModel instance — use the default initial model.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ledgerV7 = await import('@midnight-ntwrk/ledger-v7') as any;
      const costModel = ledgerV7.CostModel.initialCostModel();

      // Transaction.prove(provider, costModel) calls laceProvider.prove() for each
      // circuit, returning Transaction<SignatureEnabled, Proof, PreBinding>.
      return unprovenTx.prove(laceProvider, costModel);
    },
  };
}

// ─── Lace Wallet + Midnight Providers ────────────────────────────────────────

/**
 * Creates walletProvider + midnightProvider from a connected Lace ConnectedAPI.
 *
 * Pre-fetches shielded public keys so getCoinPublicKey/getEncryptionPublicKey
 * are synchronous (the contracts SDK calls them synchronously).
 */
export async function createLaceProviders(api: ConnectedAPI) {
  const { shieldedCoinPublicKey, shieldedEncryptionPublicKey } =
    await api.getShieldedAddresses();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const walletProvider: any = {
    // Synchronous getters — values are pre-fetched above.
    getCoinPublicKey:       () => shieldedCoinPublicKey,
    getEncryptionPublicKey: () => shieldedEncryptionPublicKey,

    /**
     * Balance a proven (unbound) transaction via Lace.
     * Lace adds inputs/outputs to cover fees and imbalances, returning a
     * Transaction<SignatureEnabled, Proof, Binding> (FinalizedTransaction).
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async balanceTx(provenTx: any) {
      const [utils, ledgerV7] = await Promise.all([
        import('@midnight-ntwrk/midnight-js-utils'),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        import('@midnight-ntwrk/ledger-v7') as Promise<any>,
      ]);
      const hex = utils.toHex(provenTx.serialize() as Uint8Array);
      const { tx: balancedHex } = await api.balanceUnsealedTransaction(hex);
      // Reconstruct as Transaction<'signature', 'proof', 'binding'>
      return ledgerV7.Transaction.deserialize(
        'signature', 'proof', 'binding',
        utils.fromHex(balancedHex),
      );
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const midnightProvider: any = {
    /**
     * Submit a finalized transaction via Lace.
     * Returns the last transaction identifier so watchForTxData can poll for it.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async submitTx(balancedTx: any) {
      const { toHex } = await import('@midnight-ntwrk/midnight-js-utils');
      await api.submitTransaction(toHex(balancedTx.serialize() as Uint8Array));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (balancedTx.identifiers() as any[]).at(-1);
    },
  };

  return { walletProvider, midnightProvider };
}

// ─── All Browser Providers ───────────────────────────────────────────────────

/**
 * Creates all six MidnightProviders needed for browser-based contract deployment.
 * Uses the Lace ConnectedAPI for proving, balancing, and submitting transactions.
 *
 * @param api          - Lace ConnectedAPI from WalletContext
 * @param indexerUrl   - Midnight indexer GraphQL endpoint
 * @param buildPath    - Path prefix for ZK artifacts (default: '/build')
 */
export async function createAllBrowserProviders(
  api: ConnectedAPI,
  indexerUrl: string,
  buildPath = '/build',
) {
  const { walletProvider, midnightProvider } = await createLaceProviders(api);

  return {
    privateStateProvider: makeInMemoryPrivateStateProvider(),
    publicDataProvider:   makeBrowserPublicDataProvider(indexerUrl),
    zkConfigProvider:     makeBrowserZkConfigProvider(buildPath),
    proofProvider:        makeBrowserProofProvider(api, buildPath),
    walletProvider,
    midnightProvider,
  };
}
