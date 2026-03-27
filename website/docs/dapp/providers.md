---
sidebar_position: 1
title: Providers
---

# Providers

The Midnight SDK requires six providers to deploy and interact with a contract. Kosh configures them in `src/dapp/providers.ts` with two separate factory functions: one for the browser (backed by the Lace wallet) and one for Node.js scripts.

## The Six Providers

| Provider | Interface | Purpose |
|----------|-----------|---------|
| `privateStateProvider` | `PrivateStateProvider` | Reads/writes member secrets |
| `publicDataProvider` | `PublicDataProvider` | Queries ledger state via Indexer GraphQL |
| `zkConfigProvider` | `ZKConfigProvider` | Loads ZK circuit keys |
| `proofProvider` | `ProofProvider` | Sends circuit inputs to the remote proof server |
| `walletProvider` | `WalletProvider` | Balances and signs transactions via Lace |
| `midnightProvider` | `MidnightProvider` | Submits signed transactions to the node |

The first four are infrastructure providers. The last two are backed by the user's connected Lace wallet and are required for any operation that moves funds or modifies on-chain state.

## Browser Providers

In the browser, all six providers are created by `createBrowserProviders()`:

```typescript
import { createBrowserProviders } from '@/dapp/providers';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';

const providers = await createBrowserProviders(connectedApi);
```

This calls `createAllBrowserProviders()` from `src/dapp/lace-providers.ts`, which wraps the Lace `ConnectedAPI` into the SDK provider interfaces:

- **`walletProvider`** — delegates `balanceTx` to `api.balanceUnsealedTransaction()`
- **`midnightProvider`** — delegates `submitTx` to `api.submitTransaction()`
- **`zkConfigProvider`** — fetches ZK keys from `/build/keys/` and `/build/zkir/` (served statically)
- **`proofProvider`** — sends proof requests to `https://proof-server.preview.midnight.network`
- **`publicDataProvider`** — reads state from the preview Indexer GraphQL endpoint
- **`privateStateProvider`** — stores member secrets in-memory during the browser session

```typescript
// src/dapp/lace-providers.ts (simplified)
export async function createAllBrowserProviders(
  connectedApi: ConnectedAPI,
  indexerUri: string,
): Promise<KoshProviders> {
  return {
    walletProvider:       createWalletProvider(connectedApi),
    midnightProvider:     createMidnightProvider(connectedApi),
    zkConfigProvider:     createBrowserZkConfigProvider('/build'),
    proofProvider:        createBrowserProofProvider(ENV.PROOF_SERVER_URL),
    publicDataProvider:   createBrowserPublicDataProvider(indexerUri),
    privateStateProvider: createInMemoryPrivateStateProvider(),
  };
}
```

## Node.js Providers (Local Dev)

For deploy scripts and integration tests, `createProviders()` returns Node.js-compatible providers:

```typescript
import { createProviders } from '@/dapp/providers';

const providers = await createProviders(
  './build',          // Path to Compact compiler output
  '~/.kosh/state',    // LevelDB path for private state
);
```

These use:
- **`levelPrivateStateProvider`** — LevelDB on the local filesystem
- **`NodeZkConfigProvider`** — loads keys from `build/keys/` and `build/zkir/`
- **`HttpClientProofProvider`** — HTTP client to the proof server (local Docker at `:6300` or remote)
- **`IndexerPublicDataProvider`** — GraphQL client to the Indexer

The Node.js providers do **not** include `walletProvider` or `midnightProvider` — these must be supplied separately when running against a real network.

## Environment Variables

All endpoint URLs are configurable via `.env.local`:

```env
NEXT_PUBLIC_INDEXER_URL=https://indexer.preview.midnight.network/api/v3/graphql
NEXT_PUBLIC_INDEXER_WS_URL=wss://indexer.preview.midnight.network/api/v3/graphql/ws
NEXT_PUBLIC_NODE_URL=https://rpc.preview.midnight.network
NEXT_PUBLIC_PROOF_SERVER_URL=https://proof-server.preview.midnight.network
NEXT_PUBLIC_NETWORK_ID=preview
```

If no `.env.local` is present, these preview network defaults are used. For local Docker dev, override with `localhost` URLs and set `NEXT_PUBLIC_NETWORK_ID=undeployed`.

## Lace Wallet Config

On wallet connect, Kosh saves the wallet's own endpoint configuration to `sessionStorage`:

```typescript
const cfg = await api.getConfiguration();
sessionStorage.setItem('kosh:wallet:config', JSON.stringify(cfg));
```

`getLaceConfig()` reads this to ensure `publicDataProvider` uses the same Indexer endpoint as the wallet — keeping them in sync regardless of `.env.local`.

## Network ID

The network ID must be set once before any SDK calls:

```typescript
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';

setNetworkId('preview');  // Set at module load time in providers.ts
```

The network ID affects shielded address encoding and is validated by the Lace wallet. Use `preview` for the public testnet, `undeployed` for local Docker dev.
