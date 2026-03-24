/**
 * Kosh — SDK Provider Configuration
 *
 * Configures all four providers required by the Midnight SDK:
 *   1. privateStateProvider  — LevelDB, stores member secrets locally
 *   2. publicDataProvider    — Indexer GraphQL, reads on-chain state
 *   3. zkConfigProvider      — loads compiled ZK circuit artifacts (keys + zkir)
 *   4. proofProvider         — HTTP client to local proof server (Docker :6300)
 *
 * Note: MidnightProviders also requires walletProvider + midnightProvider which
 * are supplied by the connected Lace wallet at runtime via the DApp Connector API.
 */

import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import type {
  PrivateStateProvider,
  PublicDataProvider,
  ZKConfigProvider,
  ProofProvider,
} from '@midnight-ntwrk/midnight-js-types';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';

// Set network to Midnight preview — must happen before any SDK calls
setNetworkId('preview');

// ─── Environment ─────────────────────────────────────────────────────────────

export const ENV = {
  INDEXER_URL:        process.env.NEXT_PUBLIC_INDEXER_URL      ?? 'https://indexer.preview.midnight.network/api/v3/graphql',
  INDEXER_WS_URL:     process.env.NEXT_PUBLIC_INDEXER_WS_URL   ?? 'wss://indexer.preview.midnight.network/api/v3/graphql/ws',
  NODE_URL:           process.env.NEXT_PUBLIC_NODE_URL          ?? 'https://rpc.preview.midnight.network',
  PROOF_SERVER_URL:   process.env.NEXT_PUBLIC_PROOF_SERVER_URL  ?? 'https://proof-server.preview.midnight.network',
  NETWORK_ID:         process.env.NEXT_PUBLIC_NETWORK_ID        ?? 'preview',
  PRIVATE_STATE_PATH: process.env.PRIVATE_STATE_PATH            ?? '~/.kosh/state',
} as const;

/**
 * Read Lace wallet configuration from sessionStorage (set on connect).
 * Returns the wallet's preferred indexer/node endpoints when available,
 * falling back to ENV defaults.
 */
export function getLaceConfig(): { indexerUri: string; indexerWsUri: string } {
  if (typeof window === 'undefined') return { indexerUri: ENV.INDEXER_URL, indexerWsUri: ENV.INDEXER_WS_URL };
  try {
    const raw = sessionStorage.getItem('kosh:wallet:config');
    if (!raw) return { indexerUri: ENV.INDEXER_URL, indexerWsUri: ENV.INDEXER_WS_URL };
    const cfg = JSON.parse(raw);
    return {
      indexerUri:   cfg.indexerUri   ?? ENV.INDEXER_URL,
      indexerWsUri: cfg.indexerWsUri ?? ENV.INDEXER_WS_URL,
    };
  } catch {
    return { indexerUri: ENV.INDEXER_URL, indexerWsUri: ENV.INDEXER_WS_URL };
  }
}

// ─── Provider Types ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface KoshProviders {
  privateStateProvider: PrivateStateProvider<any, any>;
  publicDataProvider: PublicDataProvider;
  zkConfigProvider: ZKConfigProvider<any>;
  proofProvider: ProofProvider<any>;
  // Present when a Lace wallet is connected (required for contract deploy/call)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  walletProvider?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  midnightProvider?: any;
}

// ─── Node.js Provider Factory (DApp / tests) ─────────────────────────────────

/**
 * Creates all four SDK providers for DApp → contract interaction.
 * Call this once at startup; providers are reusable across calls.
 *
 * Designed for Node.js (scripts, tests, deploy.ts). Uses dynamic imports
 * to avoid pulling native dependencies into Next.js bundle.
 *
 * @param buildDir - Path to Compact compiler output (keys/ and zkir/ subdirs)
 * @param stateDir - Path for LevelDB private state storage
 */
export async function createProviders(
  buildDir = './build',
  stateDir = ENV.PRIVATE_STATE_PATH,
): Promise<KoshProviders> {
  // levelPrivateStateProvider is a factory function (not a class) in this SDK version
  const { levelPrivateStateProvider } = await import(
    '@midnight-ntwrk/midnight-js-level-private-state-provider'
  );

  // Public data provider and ZK config — loaded from midnight-js-contracts
  // The exact class names changed between SDK versions; import dynamically
  // to avoid compile-time binding to specific exported names.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contractsModule: any = await import('@midnight-ntwrk/midnight-js-contracts');

  const publicDataProvider: PublicDataProvider = new contractsModule.IndexerPublicDataProvider(
    ENV.INDEXER_URL,
    ENV.INDEXER_WS_URL,
  );

  const zkConfigProvider: ZKConfigProvider<any> = await contractsModule.NodeZkConfigProvider.fromDirectory(buildDir);

  const proofProvider: ProofProvider<any> = new contractsModule.HttpClientProofProvider(ENV.PROOF_SERVER_URL);

  // Config uses DB names (Level database), not file paths.
  // stateDir is used as the DB name prefix for isolation between environments.
  const privateStateProvider: PrivateStateProvider<any, any> = levelPrivateStateProvider({
    midnightDbName: stateDir,
  });

  return {
    privateStateProvider,
    publicDataProvider,
    zkConfigProvider,
    proofProvider,
  };
}

// ─── Browser Provider Factory ─────────────────────────────────────────────────

/**
 * Browser-safe provider factory for Next.js client components.
 * Uses in-memory private state (no LevelDB in browser).
 * ZK artifacts loaded from /public/build/ (served as static assets).
 *
 * @param connectedApi - Lace ConnectedAPI from WalletContext. When provided, the
 *   returned providers include walletProvider + midnightProvider so deployContract
 *   and contract calls can sign and submit transactions via the wallet.
 */
export async function createBrowserProviders(connectedApi?: ConnectedAPI): Promise<KoshProviders> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contractsModule: any = await import('@midnight-ntwrk/midnight-js-contracts');

  // Use Lace's own indexer endpoints so they stay in sync with the wallet config
  const { indexerUri, indexerWsUri } = getLaceConfig();

  const publicDataProvider: PublicDataProvider = new contractsModule.IndexerPublicDataProvider(
    indexerUri,
    indexerWsUri,
  );

  const proofProvider: ProofProvider<any> = new contractsModule.HttpClientProofProvider(ENV.PROOF_SERVER_URL);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const InMemoryPrivateStateProvider = contractsModule.InMemoryPrivateStateProvider as (new () => PrivateStateProvider<any, any>) | undefined;
  if (!InMemoryPrivateStateProvider) {
    throw new Error('InMemoryPrivateStateProvider not available in this SDK version');
  }
  const privateStateProvider: PrivateStateProvider<any, any> = new InMemoryPrivateStateProvider();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const BrowserZkConfigProvider = contractsModule.BrowserZkConfigProvider as (new (path: string) => ZKConfigProvider<any>) | undefined;
  if (!BrowserZkConfigProvider) {
    throw new Error('BrowserZkConfigProvider not available in this SDK version');
  }
  // Loads ZK keys from /build/keys/ and /build/zkir/ (served from public/build/)
  const zkConfigProvider: ZKConfigProvider<any> = new BrowserZkConfigProvider('/build');

  const base: KoshProviders = {
    privateStateProvider,
    publicDataProvider,
    zkConfigProvider,
    proofProvider,
  };

  if (!connectedApi) return base;

  // Augment with Lace wallet + midnight providers for signing and submission
  const { createLaceProviders } = await import('./lace-providers');
  const { walletProvider, midnightProvider } = await createLaceProviders(connectedApi);
  return { ...base, walletProvider, midnightProvider };
}
