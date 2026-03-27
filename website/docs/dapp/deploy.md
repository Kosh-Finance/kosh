---
sidebar_position: 2
title: Deployment
---

# Deployment

## Deploying from the Browser

Circle deployment runs entirely in the browser via `deployFromBrowser()` in `src/dapp/deploy.ts`. No server, no Docker, no local node required.

```typescript
import { deployFromBrowser } from '@/dapp/deploy';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';

const result = await deployFromBrowser(
  {
    contributionAmount: 1_000_000n,  // 1 NIGHT in smallest denomination
    memberCap: 4,
    roundCount: 4,
    roundDuration: 600n,             // seconds
  },
  connectedApi,  // from useWallet() context
);

console.log('Deployed at:', result.contractAddress);
```

### How It Works

`deployFromBrowser()`:

1. **Creates browser providers** via `createBrowserProviders(connectedApi)` — all six providers including `walletProvider` and `midnightProvider` backed by Lace
2. **Loads the compiled contract** from `public/build/contract/index.js` (served statically)
3. **Generates member secrets** for the organizer
4. **Calls `deployContract()`** from `@midnight-ntwrk/midnight-js-contracts`
5. **Lace signs and submits** the transaction — a popup appears in the extension
6. **Saves organizer's private state** in-memory under the new contract address
7. **Returns** `{ contractAddress }`

### ZK Artifacts

The compiled contract artifacts live in `public/build/` and are committed to git so they're always available to the browser:

```
public/build/
  contract/index.js   ← TypeScript bindings (entry point for deployFromBrowser)
  keys/               ← Proving and verifying keys
  zkir/               ← ZK Intermediate Representation
```

When you run `npm run compile` locally, the `prebuild` script copies `build/` → `public/build/`.

## Deployment Time

| Step | Duration |
|------|---------|
| Load ZK artifacts | < 1s |
| Generate deployment proof | 10–20s |
| Transaction submission + Lace signing | < 5s |
| Indexer confirmation | 5–10s |
| **Total** | **~20–35s** |

## Create Circle UI

The Create Circle page (`src/app/circles/create/page.tsx`) reads `connectedApi` from `WalletContext` and calls `deployFromBrowser()` directly:

```typescript
const wallet = useWallet();  // from WalletContext

async function handleDeploy() {
  const { contractAddress } = await deployFromBrowser(config, wallet.connectedApi!);
  router.push(`/circles/${contractAddress}`);
}
```

If the wallet is not connected, the page shows a "Connect Lace first" prompt instead of the deploy form.

## Server-Side Deploy (Local Dev Only)

For Node.js scripts and integration tests against a local Docker stack, use `deployKoshCircle()`:

```typescript
import { deployKoshCircle } from '@/dapp/deploy';

const result = await deployKoshCircle({
  contributionAmount: 1_000_000n,
  memberCap: 4,
  roundCount: 4,
  roundDuration: 600n,
});
```

This uses Node.js providers (LevelDB, `NodeZkConfigProvider`) and requires:
- Midnight Docker stack running (`docker compose up -d`)
- Contract compiled (`npm run compile`)
- Test wallet funded via the local funding CLI

The `/api/deploy` Next.js route also calls `deployKoshCircle()` for server-side use. **The browser no longer uses `/api/deploy`** — it uses `deployFromBrowser()` instead.

## CircleConfig

```typescript
export interface CircleConfig {
  contributionAmount: bigint;  // In smallest denomination (1 NIGHT = 1_000_000)
  memberCap: number;           // 2–16
  roundCount: number;          // Should equal memberCap
  roundDuration: bigint;       // In seconds
}
```
