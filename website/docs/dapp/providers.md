---
sidebar_position: 1
title: Providers
---

# Providers

The Midnight SDK requires four providers to interact with a deployed contract. Kosh configures them in `src/dapp/providers.ts`.

## The Four Providers

| Provider | Interface | Purpose |
|----------|-----------|---------|
| `privateStateProvider` | `LevelPrivateStateProvider` | Reads/writes member secrets to LevelDB |
| `publicDataProvider` | `IndexerPublicDataProvider` | Queries ledger state via Indexer GraphQL |
| `zkConfigProvider` | `NodeZkConfigProvider` | Loads ZK circuit keys from `build/` |
| `proofProvider` | `HttpClientProofProvider` | Sends circuit inputs to proof server |

## Configuration

```typescript
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { IndexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { HttpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';

export interface KoshProviders {
  privateStateProvider: ReturnType<typeof levelPrivateStateProvider>;
  publicDataProvider: IndexerPublicDataProvider;
  zkConfigProvider: NodeZkConfigProvider;
  proofProvider: HttpClientProofProvider;
}

export function createProviders(): KoshProviders {
  return {
    privateStateProvider: levelPrivateStateProvider({
      midnightDbName: process.env.PRIVATE_STATE_PATH ?? '~/.kosh/state',
      privateStateStoreName: 'kosh-private-state',
      signingKeyStoreName: 'kosh-signing-keys',
    }),

    publicDataProvider: new IndexerPublicDataProvider(
      process.env.NEXT_PUBLIC_INDEXER_URL ?? 'http://localhost:8088/api/v1/graphql',
      process.env.NEXT_PUBLIC_INDEXER_WS_URL ?? 'ws://localhost:8088/api/v1/graphql/ws',
    ),

    zkConfigProvider: new NodeZkConfigProvider(
      path.resolve(process.cwd(), 'build/keys'),
      path.resolve(process.cwd(), 'build/zkir'),
    ),

    proofProvider: new HttpClientProofProvider(
      process.env.NEXT_PUBLIC_PROOF_SERVER_URL ?? 'http://localhost:6300',
    ),
  };
}
```

## Browser vs. Node.js

The providers are used differently depending on context:

| Context | `privateStateProvider` | `zkConfigProvider` |
|---------|----------------------|-------------------|
| **Server-side** (API route, deploy script) | LevelDB (file system) | Loads keys from `build/` |
| **Browser** (frontend) | In-memory (no LevelDB) | Not needed (proofs via API) |

The Kosh frontend avoids directly instantiating Node.js-only providers in browser code. Instead, contract deployment and interaction that requires LevelDB goes through Next.js API routes (`/api/deploy`, etc.).

## Environment Variables

All provider URLs are configurable via `.env.local`:

```env
NEXT_PUBLIC_INDEXER_URL=http://localhost:8088/api/v1/graphql
NEXT_PUBLIC_INDEXER_WS_URL=ws://localhost:8088/api/v1/graphql/ws
NEXT_PUBLIC_NODE_URL=http://localhost:9944
NEXT_PUBLIC_PROOF_SERVER_URL=http://localhost:6300
NEXT_PUBLIC_NETWORK_ID=undeployed
PRIVATE_STATE_PATH=~/.kosh/state
```

## Network ID

The network ID must be set before any SDK calls:

```typescript
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';

setNetworkId(process.env.NEXT_PUBLIC_NETWORK_ID ?? 'undeployed');
```

For local dev, the network ID is `undeployed`. This affects address encoding and is validated by the Lace wallet extension.
