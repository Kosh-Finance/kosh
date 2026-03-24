---
slug: /
sidebar_position: 1
title: Introduction
---

# Kosh — Privacy-Preserving Savings Circles

Kosh is the first **ZK-ROSCA** (Rotating Savings and Credit Association) built on [Midnight Network](https://midnight.network). It digitizes informal savings circles — chit funds, stokvels, tandas, hui, paluwagan — using zero-knowledge proofs to keep member identities and contribution behavior private while enforcing trustless payouts and accountability.

## The Problem

Over **500 million people** worldwide participate in informal savings groups. The mechanism is simple: members pool fixed contributions each round and one member receives the full pot in rotation. This moves an estimated **$500B+ annually** — $360B in India's informal chit fund sector alone.

These groups have three structural problems:

| Problem | Traditional ROSCA | On Transparent Chain | Kosh |
|---------|------------------|---------------------|------|
| **No enforcement** | Social pressure only | Smart contract enforced | Smart contract enforced |
| **No credit building** | Participation is invisible | Participation is public | Private, portable proof |
| **Privacy** | Cash-based anonymity | Fully public on-chain | ZK anonymous |

Midnight's privacy-by-default architecture is the only blockchain where all three can be solved simultaneously.

## How It Works

```
Member A                          Member B
   │                                  │
   │  1. Join circle                  │  1. Join circle
   │     commit(secret, nonce)        │     commit(secret, nonce)
   │     → Merkle leaf (hash only)    │     → Merkle leaf (hash only)
   │                                  │
   │  2. Contribute (round 1)         │  2. Contribute (round 1)
   │     prove membership             │     prove membership
   │     + round nullifier            │     + round nullifier
   │     (unlinkable to identity)     │     (unlinkable to identity)
   │                                  │
   │  3. Claim payout (round 1)       │  3. Wait for round 2
   │     prove leaf position = 0      │     → receives pool in round 2
   │     → receives full pool         │
   │                                  │
```

Every step is enforced by a ZK smart contract. No organizer can redirect funds. No member can be identified from on-chain data unless they default.

## Key Properties

- **Anonymous contributions** — No link between a member's identity and their contributions on-chain
- **Trustless payouts** — Round-robin order enforced by the contract; no organizer involvement needed
- **Conditional deanonymization** — Only a defaulter's commitment hash is revealed; honest members stay private
- **Portable participation proofs** — Completed circles generate a ZK receipt usable for future credit
- **Local secrets** — Member secrets never leave the user's machine (witness functions run locally)

## Built on Midnight

Kosh uses [Compact](https://docs.midnight.network/develop/reference/compact/lang-ref), Midnight's ZK smart contract language. Compact compiles directly to Halo2-based zk-SNARK circuits on the BLS12-381 curve — the same cryptographic foundation as Zcash.

```
rosca.compact → Compact compiler v0.29.0 → Halo2 circuit → ZK proofs
```

## Quick Links

- [Local dev setup →](/getting-started/local-dev)
- [Architecture overview →](/architecture/overview)
- [Privacy guarantees →](/security/privacy-guarantees)
- [Contract circuits →](/contract/circuits)
