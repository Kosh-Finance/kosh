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
import { parseCoinPublicKeyToHex, parseEncPublicKeyToHex, fromHex } from '@midnight-ntwrk/midnight-js-utils';
import { getNetworkId } from '@midnight-ntwrk/midnight-js-network-id';

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
 * Implements the PublicDataProvider interface for browser use via the Midnight indexer GraphQL API.
 *
 * Implements:
 *   - watchForTxData        — polls for call/deploy tx confirmation (used by submitTx)
 *   - watchForDeployTxData  — polls until contract state appears (used by findDeployedContract)
 *   - queryContractState    — fetches + deserializes current contract state (used by getLedgerState)
 *   - queryZSwapAndContractState — fetches both states (used by getPublicStates)
 *   - queryDeployContractState   — returns initial (= current) contract state
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function makeBrowserPublicDataProvider(indexerUrl: string): any {
  const POLL_INTERVAL_MS = 2000;
  const MAX_POLLS = 150; // ~5 minutes

  // ── Transaction status query ────────────────────────────────────────────────

  async function queryTxStatus(txId: string) {
    const res = await fetch(indexerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query TransactionStatus($transactionId: HexEncoded!) {
          transactions(offset: {identifier: $transactionId}) {
            ... on RegularTransaction {
              identifiers
              hash
              block { hash height }
              transactionResult { status }
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

  // ── Contract action query (state + chainState) ───────────────────────────────

  async function queryContractAction(contractAddress: string) {
    const res = await fetch(indexerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query ContractState($address: HexEncoded!) {
          contractAction(address: $address) {
            state
            chainState
            transaction {
              ... on RegularTransaction {
                hash
                block { hash height }
              }
            }
          }
        }`,
        variables: { address: contractAddress },
      }),
    });
    if (!res.ok) throw new Error(`Indexer contractAction query failed: ${res.status}`);
    const json = await res.json();
    return json?.data?.contractAction ?? null;
  }

  // ── Deserializer helpers ──────────────────────────────────────────────────────

  async function deserializeContractState(stateHex: string) {
    const { fromHex } = await import('@midnight-ntwrk/midnight-js-utils');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { ContractState } = await import('@midnight-ntwrk/compact-runtime') as any;
    return ContractState.deserialize(fromHex(stateHex));
  }

  async function deserializeZswapChainState(chainStateHex: string) {
    const { fromHex } = await import('@midnight-ntwrk/midnight-js-utils');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { ZswapChainState } = await import('@midnight-ntwrk/ledger-v7') as any;
    return ZswapChainState.deserialize(fromHex(chainStateHex));
  }

  return {
    // ── watchForTxData ────────────────────────────────────────────────────────
    async watchForTxData(txId: string) {
      for (let i = 0; i < MAX_POLLS; i++) {
        const tx = await queryTxStatus(txId);
        if (tx) {
          const raw = tx.transactionResult?.status as string | undefined;
          const status =
            raw === 'SUCCESS'         ? 'SucceedEntirely' :
            raw === 'PARTIAL_SUCCESS' ? 'FailFallible'    : 'FailEntirely';
          return {
            tx: null as any, // eslint-disable-line @typescript-eslint/no-explicit-any
            status,
            txId,
            txHash: tx.hash ?? txId,
            blockHash: tx.block?.hash ?? txId,
            blockHeight: tx.block?.height ?? 0,
          };
        }
        await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
      throw new Error(
        `Transaction ${txId} not confirmed after ${(MAX_POLLS * POLL_INTERVAL_MS) / 1000}s`,
      );
    },

    // ── watchForDeployTxData ──────────────────────────────────────────────────
    // Called by findDeployedContract — polls until the deployed contract's state appears.
    async watchForDeployTxData(contractAddress: string) {
      for (let i = 0; i < MAX_POLLS; i++) {
        const action = await queryContractAction(contractAddress);
        if (action) {
          const tx = action.transaction;
          return {
            tx: null as any, // eslint-disable-line @typescript-eslint/no-explicit-any
            status: 'SucceedEntirely',
            txId: contractAddress,
            txHash: tx?.hash ?? contractAddress,
            blockHash: tx?.block?.hash ?? contractAddress,
            blockHeight: tx?.block?.height ?? 0,
          };
        }
        await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
      throw new Error(`No contract found at ${contractAddress} after polling`);
    },

    // ── queryContractState ────────────────────────────────────────────────────
    // Returns the current deserialized ContractState, or null if not found.
    async queryContractState(contractAddress: string) {
      const action = await queryContractAction(contractAddress);
      if (!action?.state) return null;
      return deserializeContractState(action.state);
    },

    // ── queryZSwapAndContractState ────────────────────────────────────────────
    // Returns [ZswapChainState, ContractState] or null. Used by getPublicStates().
    async queryZSwapAndContractState(contractAddress: string) {
      const action = await queryContractAction(contractAddress);
      if (!action?.state || !action?.chainState) return null;
      const [zswapChainState, contractState] = await Promise.all([
        deserializeZswapChainState(action.chainState),
        deserializeContractState(action.state),
      ]);
      return [zswapChainState, contractState];
    },

    // ── queryDeployContractState ──────────────────────────────────────────────
    // Returns the initial contract state at deploy time. Since the indexer only
    // exposes the *current* state, we return current state as a best approximation.
    async queryDeployContractState(contractAddress: string) {
      const action = await queryContractAction(contractAddress);
      if (!action?.state) return null;
      return deserializeContractState(action.state);
    },

    // ── Unsupported streaming methods ────────────────────────────────────────
    async watchForContractState(): Promise<never> {
      throw new Error('watchForContractState not implemented for browser');
    },
    contractStateObservable(): never {
      throw new Error('contractStateObservable not implemented for browser');
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

  // Decode Bech32m keys to { bytes: Uint8Array } — the format the Midnight SDK's
  // WalletProvider interface expects for coinPublicKey and encryptionPublicKey.
  const networkId = getNetworkId();
  const coinPublicKey   = { bytes: fromHex(parseCoinPublicKeyToHex(shieldedCoinPublicKey, networkId)) };
  const encPublicKey    = { bytes: fromHex(parseEncPublicKeyToHex(shieldedEncryptionPublicKey, networkId)) };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const walletProvider: any = {
    // Readonly properties — newer midnight-js-types accesses these as properties.
    coinPublicKey,
    encryptionPublicKey: encPublicKey,
    // Method forms — older midnight-js-types (bundled inside midnight-js-contracts)
    // calls getCoinPublicKey() and getEncryptionPublicKey() as methods.
    getCoinPublicKey()       { return coinPublicKey; },
    getEncryptionPublicKey() { return encPublicKey; },

    /**
     * Balance a proven (unbound) transaction via Lace.
     * Lace adds inputs/outputs to cover fees and imbalances, returning a
     * Transaction<SignatureEnabled, Proof, Binding> (FinalizedTransaction).
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async balanceTx(provenTx: any, _newCoins: unknown[]) {
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
