---
sidebar_position: 1
title: System Overview
---

# System Architecture Overview

Kosh is built in three layers, adapted to Midnight's unique execution model where contract logic is split across a public ledger, a zero-knowledge circuit, and a local off-chain environment.

## Layer Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                      PRESENTATION LAYER                       │
│                                                               │
│   Next.js 15 Frontend ←→ Lace Wallet (Chrome Extension)      │
│   - Circle management UI                                      │
│   - DApp Connector API v4.0.0                                 │
│   - Connects to localhost:3000 (dev)                          │
└───────────────────────────┬──────────────────────────────────┘
                             │
┌───────────────────────────▼──────────────────────────────────┐
│                     APPLICATION LAYER                         │
│                                                               │
│   TypeScript DApp (src/dapp/)                                 │
│   ├── Witness functions  (member secrets → ZK circuits)       │
│   ├── Private state      (LevelDB — member secrets local)     │
│   ├── Contract interaction (midnight-js-contracts v3.1.0)     │
│   └── Proof generation   (HTTP → proof server :6300)          │
└───────────────────────────┬──────────────────────────────────┘
                             │
┌───────────────────────────▼──────────────────────────────────┐
│                      PROTOCOL LAYER                           │
│                                                               │
│   rosca.compact (single monolithic Compact contract)          │
│   ├── Public Ledger State                                     │
│   │   ├── MerkleTree<4, Bytes<32>>  (member commitments)      │
│   │   ├── Set<Bytes<32>>            (spent round identifiers) │
│   │   ├── Counter                   (current round)           │
│   │   ├── CircleStatus enum         (lifecycle state)         │
│   │   └── Pool balance              (aggregate NIGHT)         │
│   ├── ZK Circuit Logic                                        │
│   │   ├── Membership verification   (Merkle path proof)       │
│   │   ├── Contribution validation   (amount + nullifier)      │
│   │   ├── Payout authorization      (position verification)   │
│   │   └── Default identification    (conditional disclosure)  │
│   └── Zswap Token Operations                                  │
│       ├── send()    (member contribution to pool)             │
│       └── receive() (payout from pool to recipient)           │
└───────────────────────────┬──────────────────────────────────┘
                             │
┌───────────────────────────▼──────────────────────────────────┐
│                    INFRASTRUCTURE LAYER                       │
│                                                               │
│   Docker Compose Stack                                        │
│   ├── Midnight Node       v0.22.1  :9944                      │
│   ├── Indexer + GraphQL   v4.0.0   :8088                      │
│   └── Proof Server        v8.0.3   :6300                      │
│                                                               │
│   Network ID: "undeployed"                                    │
└──────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### Monolithic Contract

Cross-contract calls are not yet supported in Compact. All ROSCA logic — membership, contributions, payouts, defaults, participation records — lives in a single `rosca.compact` file.

**Tradeoff:** Larger circuit, longer compile times, but no alternative exists in the current Compact version.

### Fixed Member Cap at Compile Time

Compact requires all loop iterations to be known at compile time. No dynamic arrays or unbounded iteration.

**Decision:** Member pool size is a compile-time constant embedded in the Merkle tree depth. `MerkleTree<4, Bytes<32>>` gives depth 4 = up to 16 leaves. Multiple compiled variants can be deployed for different circle sizes (4, 8, 16 members).

### Round-Robin Payouts

The current implementation uses round-robin payout rotation: leaf position equals payout round number. Bid-based ordering (auction for earlier payout) adds significant circuit complexity and is deferred.

### Local Proof Generation

The proof server runs as a Docker container on the user's machine. **Witness data (member secrets) never leaves the machine.** This is the correct architecture for the Assemble Program. Client-side WASM proofs are on the production roadmap.

## SDK Stack

| Package | Version | Role |
|---------|---------|------|
| `@midnight-ntwrk/midnight-js-contracts` | 3.1.0 | Deploy + call contracts |
| `@midnight-ntwrk/dapp-connector-api` | 4.0.0 | Lace wallet integration |
| `@midnight-ntwrk/midnight-js-level-private-state-provider` | latest | LevelDB private state |
| `@midnight-ntwrk/wallet-sdk-facade` | 2.0.0 | Unified wallet interface |
| `@midnight-ntwrk/compact-runtime` | 0.14.0 | Compact output runtime |
| `@midnight-ntwrk/ledger-v8` | 8.0.3 | Ledger types |
