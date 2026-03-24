---
sidebar_position: 1
title: Ledger State
---

# Ledger State

The public ledger state is stored on-chain and visible to anyone via the Indexer GraphQL API. All values are set via `disclose()` calls inside circuits.

## Public Ledger Variables

```compact
// ─── Circle Parameters (set once on createCircle) ───────────────
export ledger contributionAmount: Uint<64>;
export ledger memberCap: Uint<8>;
export ledger roundCount: Uint<8>;
export ledger roundDuration: Uint<64>;

// ─── Round State ─────────────────────────────────────────────────
export ledger currentRound: Counter;
export ledger circleStatus: CircleStatus;
export ledger contributionsThisRound: Cell<Uint<8>>;
export ledger roundDeadline: Cell<Uint<64>>;
export ledger payoutClaimed: Cell<Boolean>;

// ─── Membership ──────────────────────────────────────────────────
export ledger memberTree: MerkleTree<4, Bytes<32>>;
export ledger memberCount: Cell<Uint<8>>;

// ─── Privacy Enforcement ─────────────────────────────────────────
export ledger spentIdentifiers: Set<Bytes<32>>;
```

## Field Reference

### Circle Parameters

| Field | Type | Description |
|-------|------|-------------|
| `contributionAmount` | `Uint<64>` | Fixed NIGHT amount each member contributes per round. In smallest denomination (1,000,000 = 1 NIGHT). |
| `memberCap` | `Uint<8>` | Maximum number of members. Bounded by Merkle tree depth: `MerkleTree<4>` allows up to 16. |
| `roundCount` | `Uint<8>` | Total number of rounds. In a standard ROSCA, equals `memberCap`. |
| `roundDuration` | `Uint<64>` | Duration of each round in block timestamps (seconds on local dev). |

### Round State

| Field | Type | Description |
|-------|------|-------------|
| `currentRound` | `Counter` | Zero-indexed round counter. Increments on each `claimPayout()`. |
| `circleStatus` | `CircleStatus` | Current lifecycle state. See [State Machine](/architecture/state-machine). |
| `contributionsThisRound` | `Cell<Uint<8>>` | Number of contributions received in the current round. Resets to 0 at round start. |
| `roundDeadline` | `Cell<Uint<64>>` | Block timestamp deadline for the current round. |
| `payoutClaimed` | `Cell<Boolean>` | Whether the payout has been claimed for the current round. Prevents double-claiming. |

### Membership

| Field | Type | Description |
|-------|------|-------------|
| `memberTree` | `MerkleTree<4, Bytes<32>>` | Sparse Merkle tree of member identity commitments. Depth 4 = up to 16 leaves. Each leaf is `persistentCommit(secret, nonce)`. |
| `memberCount` | `Cell<Uint<8>>` | Number of members who have joined. Determines leaf insertion index. |

### Privacy Enforcement

| Field | Type | Description |
|-------|------|-------------|
| `spentIdentifiers` | `Set<Bytes<32>>` | Set of `persistentHash(secret || roundNumber)` values. Each member can only appear once per round (prevents double-contribution). The hash is unlinkable to the identity commitment. |

## Reading Ledger State

Via the Indexer GraphQL at `http://localhost:8088/api/v1/graphql`:

```graphql
query CircleState($address: String!) {
  contract(address: $address) {
    ledger {
      contributionAmount
      memberCap
      roundCount
      currentRound
      circleStatus
      memberCount
      contributionsThisRound
      roundDeadline
      payoutClaimed
      memberTree {
        root
      }
    }
  }
}
```

Via the TypeScript DApp layer:

```typescript
import { getLedgerState } from '@/dapp/interact';
import { createProviders } from '@/dapp/providers';

const providers = await createProviders();
const state = await getLedgerState(providers, contractAddress, contractModule);
// Returns CircleLedgerState with JS-typed fields
```

## CircleStatus Enum

```compact
enum CircleStatus {
  OPEN,             // accepting members
  ACTIVE,           // (transitional — unused in final impl)
  ROUND_IN_PROGRESS,// contributions being collected
  PAYOUT_PENDING,   // all contributed, awaiting claim
  DEFAULT_DETECTED, // deadline passed with missing contributions
  COMPLETED         // all rounds done
}
```
