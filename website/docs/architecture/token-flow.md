---
sidebar_position: 5
title: Token Flow
---

# Token Flow

Kosh uses Midnight's native [Zswap protocol](https://eprint.iacr.org/2022/1002) for all token transfers. Zswap uses a UTXO-based commitment/nullifier model at the protocol level — shielded transfers are private by default.

## Contribution Flow

Every round, each member sends `contributionAmount` NIGHT to the contract:

```
Member Wallet                    Contract Pool
┌─────────────────┐             ┌──────────────────┐
│  NIGHT UTXO     │ ─send()──►  │  Pool Balance     │
│  (shielded)     │             │  (aggregate,       │
│                 │             │   visible on-chain)│
└─────────────────┘             └──────────────────┘
```

The contract's pool balance (aggregate NIGHT received) is visible on-chain. Individual contribution amounts are verified in-circuit — the public ledger only shows the total.

## Payout Flow

When all members contribute, the designated recipient claims the full pool:

```
Contract Pool                    Recipient Wallet
┌──────────────────┐             ┌─────────────────┐
│  Pool Balance    │ ─receive()─►│  NIGHT UTXO     │
│  (full round     │             │  (shielded)     │
│   amount)        │             │                 │
└──────────────────┘             └─────────────────┘
```

`receive()` transfers `contributionAmount × memberCount` to the recipient's shielded wallet.

## Economics

Over a full circle, the math is zero-sum:

| Member | Contributes | Receives | Net |
|--------|-------------|---------|-----|
| Member 0 (round 0) | `amount × rounds` | `amount × members` | 0 |
| Member 1 (round 1) | `amount × rounds` | `amount × members` | 0 |
| ... | ... | ... | 0 |

With `rounds = members` (standard ROSCA), every member contributes exactly what they receive. The value proposition is **time preference**: earlier payout recipients access capital sooner, while later recipients effectively earn the time value of their locked contributions.

Example with 4 members, 1 NIGHT contribution, 4 rounds:

```
Round 1: A,B,C,D contribute (4 NIGHT pool) → Member A claims 4 NIGHT
Round 2: A,B,C,D contribute (4 NIGHT pool) → Member B claims 4 NIGHT
Round 3: A,B,C,D contribute (4 NIGHT pool) → Member C claims 4 NIGHT
Round 4: A,B,C,D contribute (4 NIGHT pool) → Member D claims 4 NIGHT

Total contributed per member: 4 NIGHT
Total received per member:    4 NIGHT
```

## DUST Gas Model

Every transaction requires **DUST** for gas fees:

- DUST is non-transferable
- Generated from NIGHT holdings at a rate of **5 DUST per NIGHT**
- Automatically registered by the `midnight-local-dev` funding CLI
- The Kosh frontend checks DUST balance before prompting any transaction

A low DUST warning appears in the circle dashboard if balance drops below the threshold needed for the remaining rounds.

## Zswap vs. Transparent Transfers

| Property | Zswap (Kosh) | Transparent Transfer |
|----------|-------------|---------------------|
| Sender visible | No | Yes |
| Amount visible | Aggregate only | Yes |
| Recipient visible | No (proven in-circuit) | Yes |
| Double-spend prevention | Nullifiers (on-chain set) | UTXO tracking |

Kosh uses `send()` for contributions and `receive()` for payouts — both are shielded Zswap operations. The contract tracks aggregate pool balance on the public ledger, but individual transfers are opaque.
