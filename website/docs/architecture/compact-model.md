---
sidebar_position: 2
title: Compact Execution Model
---

# Compact Execution Model

Midnight's Compact language splits contract execution across three domains. Understanding this split is essential for reasoning about what Kosh makes public, what it keeps private, and where each computation runs.

## Three Execution Domains

```
┌──────────────────────────────────────────────────────────────┐
│                      Compact Contract                         │
│                                                               │
│  ┌──────────────────┐ ┌──────────────┐ ┌────────────────┐   │
│  │   PUBLIC LEDGER   │ │  ZK CIRCUIT  │ │  LOCAL (DApp)  │   │
│  │                   │ │              │ │                │   │
│  │ State stored      │ │ Computations │ │ Witness        │   │
│  │ on-chain,         │ │ that produce │ │ functions that │   │
│  │ visible to all.   │ │ ZK proofs.   │ │ provide secret │   │
│  │                   │ │ Verifiable   │ │ data. Never    │   │
│  │ Only modified     │ │ without      │ │ leaves the     │   │
│  │ via disclose()    │ │ revealing    │ │ user's machine.│   │
│  │                   │ │ inputs.      │ │                │   │
│  │ In Kosh:          │ │ In Kosh:     │ │ In Kosh:       │   │
│  │ - Merkle root     │ │ - Membership │ │ - memberSecret │   │
│  │ - Round number    │ │   proof      │ │ - memberNonce  │   │
│  │ - Pool balance    │ │ - Nullifier  │ │ - merklePath   │   │
│  │ - Spent IDs       │ │   check      │ │                │   │
│  │ - Circle status   │ │ - Position   │ │                │   │
│  │                   │ │   verify     │ │                │   │
│  └──────────────────┘ └──────────────┘ └────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

## Data Flow for a Contribution

The contribution circuit is the most complex. Here's the full flow:

```
Member's Browser              Proof Server (Docker)     Midnight Node
      │                               │                       │
      │ 1. Click "Contribute"         │                       │
      │                               │                       │
      │ 2. Load witness data          │                       │
      │    from LevelDB:              │                       │
      │    - memberSecret             │                       │
      │    - merklePath               │                       │
      │                               │                       │
      │ 3. Send circuit inputs ──────►│                       │
      │    (witness data +            │                       │
      │     public ledger state)      │                       │
      │                               │                       │
      │                      4. Proof server                  │
      │                         generates ZK proof            │
      │                         (~30–60 seconds)              │
      │                               │                       │
      │ 5. Proof returned ◄──────────│                       │
      │                               │                       │
      │ 6. Submit transaction ───────────────────────────────►│
      │    (proof + state update                               │
      │     + Zswap token transfer)                            │
      │                               │                       │
      │                               │   7. Node verifies    │
      │                               │      proof (~6ms)     │
      │                               │      Updates ledger   │
      │                               │      Processes Zswap  │
      │                               │                       │
      │ 8. Confirmation ◄─────────────────────────────────────│
      │    (via Indexer GraphQL)       │                       │
```

## Witness Functions

Witnesses are **declared** in Compact but **implemented** in TypeScript. The contract specifies what data it needs; the DApp provides the concrete values from local storage:

```compact
// Declared in rosca.compact
witness memberSecret(): Bytes<32>;
witness memberNonce(): Bytes<32>;
witness memberMerklePath(): MerkleTreePath<4>;
witness roundNonce(): Bytes<32>;
```

```typescript
// Implemented in src/dapp/witnesses.ts
const witnesses = {
  memberSecret: () => state.memberSecret,    // from LevelDB
  memberNonce:  () => state.memberNonce,     // from LevelDB
  memberMerklePath: () => computePath(...),  // computed from ledger
  roundNonce:   () => crypto.getRandomValues(new Uint8Array(32)),
};
```

The TypeScript witnesses run **locally** — data is passed to the proof server to generate the proof, but no witness data is published on-chain.

## The `disclose()` Boundary

In Compact, the only way to modify public ledger state is via explicit `disclose()` calls. Everything else stays inside the ZK circuit — computed but never published.

In the `joinCircle` circuit:

```compact
// This commitment goes on-chain:
disclose(commitment)  // → stored in MerkleTree

// But the inputs stay private:
// memberSecret() — never published
// memberNonce()  — never published
```

This is why the Merkle root updates on each join (public) while the actual member identity (secret + nonce) stays local.
