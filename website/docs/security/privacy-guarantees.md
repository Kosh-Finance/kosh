---
sidebar_position: 1
title: Privacy Guarantees
---

# Privacy Guarantees

## What Is Private

| Data | Visibility | Mechanism |
|------|------------|-----------|
| Member identity | **Private** | Commitment stored in Merkle tree; secret + nonce stay in LevelDB |
| Which member contributed | **Private** | Round nullifier uses different hash construction than identity commitment — unlinkable |
| Contribution amount (individual) | **Private** | Verified in-circuit; only aggregate pool balance is on-chain |
| Payout recipient identity | **Private** | Membership + position verified in-circuit; no identity disclosed |
| Participation history | **Private** | Member controls disclosure via participation proof |
| Member secrets and nonces | **Private** | Witness functions run locally; data never transmitted beyond the proof server on the same machine |

## What Is Public

| Data | Visibility | Why |
|------|------------|-----|
| Circle parameters (amount, cap, rounds, duration) | **Public** | Required for group coordination |
| Circle status and current round | **Public** | Members need to know when to contribute |
| Merkle root of member commitments | **Public** | Required to verify membership proofs on-chain |
| Aggregate pool balance | **Public** | Transparency that contributions are received |
| Number of members joined | **Public** | Members can see if circle is filling up |
| Spent round nullifiers | **Public** | Required for double-contribution prevention |
| Defaulter commitment hash | **Conditionally public** | Only revealed if default detected; only the defaulter's commitment |

## The Unlinkability Property

The core privacy guarantee relies on two cryptographic constructions that are computationally unlinkable:

```
Identity commitment:
  commitment = persistentCommit(memberSecret, memberNonce)
  → Uses Poseidon hash with randomized nonce
  → Different nonce = different commitment for same secret
  → Stored in MerkleTree (permanent, public root)

Round nullifier:
  roundId = persistentHash(memberSecret || currentRound)
  → Uses Poseidon hash without nonce (deterministic)
  → Same member always produces same nullifier for same round
  → Added to Set<Bytes<32>> (spentIdentifiers, public)
```

**Why they are unlinkable:**

An on-chain observer sees the Merkle tree of commitments and the set of nullifiers. To link them, they would need to find a `(secret, nonce)` pair such that:

```
persistentCommit(secret, nonce) = known_commitment
AND
persistentHash(secret || round)  = known_nullifier
```

This requires inverting a one-way Poseidon hash — computationally infeasible under standard cryptographic assumptions (collision resistance of Poseidon as used in Halo2/Compact on BLS12-381).

## Comparison to Transparent Chains

On a transparent blockchain, a savings circle would expose:

- Every member's wallet address
- Contribution amounts and timestamps
- Which wallet sent how much in each round
- Payout recipients

Kosh on Midnight exposes:

- Circle parameters (by design — needed for coordination)
- That *someone* contributed (but not who)
- That *someone* claimed the payout (but not who)
- The defaulter's commitment hash (but not their real-world identity)

## Participation Proof Privacy

After circle completion, members can generate a ZK receipt:

```
receipt = persistentCommit(memberSecret, circleCompletion)
```

The receipt proves:
- "I completed a savings circle"
- "The circle ran for N rounds"
- "My contribution rate was 100%"

Without revealing:
- Which circle
- Who the member is
- When the circle ran

This receipt can be presented to lending protocols or external verifiers as a privacy-preserving credit signal.
