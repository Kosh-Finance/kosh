---
sidebar_position: 3
title: Privacy Scheme
---

# Privacy Scheme

Kosh's privacy model relies on two cryptographic constructions that serve different purposes and are **computationally unlinkable** to each other.

## Identity Commitment (Joining)

When a member joins a circle, they commit their identity into a Merkle tree:

```
memberSecret  (32 bytes, random) ─┐
                                   ├─► persistentCommit(secret, nonce) → commitment
memberNonce   (32 bytes, random) ─┘
                                            │
                                            ▼
                                   Inserted as leaf in
                                   MerkleTree<4, Bytes<32>>
```

**What goes on-chain:** The commitment (a Poseidon hash).
**What stays local:** The secret and nonce (in LevelDB via `privateStateProvider`).

The Merkle root updates on-chain — anyone can see a new member joined — but no one can determine who it is from the commitment alone.

## Round Nullifier (Contributing)

When a member contributes to a round, they compute a round-specific identifier:

```
memberSecret  (same secret from join) ─┐
                                        ├─► persistentHash(secret || roundNumber) → roundId
currentRound  (public, from ledger)   ─┘
                                            │
                                            ▼
                                   Added to Set<Bytes<32>>
                                   (spentIdentifiers on-chain)
```

**What goes on-chain:** The `roundId` (a deterministic hash, no nonce).
**What stays private:** Which member produced it.

The `roundId` is deterministic: the same member always produces the same `roundId` for round N. This enables **double-contribution prevention** — the contract checks `!spentIdentifiers.member(roundId)`. But the observer only sees the hash, not the member.

## Why They Are Unlinkable

| Property | Identity Commitment | Round Nullifier |
|----------|-------------------|----------------|
| Hash function | `persistentCommit(secret, nonce)` | `persistentHash(secret \|\| round)` |
| Includes nonce? | Yes — randomized | No — deterministic |
| Stored in | `MerkleTree` (permanent) | `Set` (per-round) |
| Purpose | Prove membership | Prevent double contribution |
| Linkable to other? | Only with secret + nonce | Only with secret |

An on-chain observer sees the Merkle tree of commitments and the set of nullifiers. To link them, they would need to find a `(secret, nonce)` pair such that:

```
persistentCommit(secret, nonce) = known_commitment
AND
persistentHash(secret || round)  = known_nullifier
```

This requires inverting a one-way Poseidon hash — computationally infeasible.

## Membership Proof (In-Circuit)

To prove membership without revealing position, a member provides a Merkle authentication path:

```compact
circuit verifyMembership(path: MerkleTreePath<4>): Bytes<32> {
  // Recompute commitment from secret witnesses
  const commitment = persistentCommit(memberSecret(), memberNonce());

  // Verify the commitment exists anywhere in the tree
  // (does not reveal which leaf position)
  assert merkleTreePathRoot(path, commitment) == memberTree.root;

  return commitment;
}
```

The verifier confirms the member is in the tree. The **leaf position** is not disclosed by this check — position is only verified when claiming a payout (where it's required by the protocol).

## Payout Recipient Privacy

Even payout claims maintain privacy. The recipient proves:
1. They are a valid member (Merkle path proof)
2. Their leaf index equals `currentRound` (position proof)

The identity behind the leaf position is not revealed — only that *someone* at that position claimed the payout.

## Conditional Deanonymization

The `reportDefault` circuit uses a **proof-of-absence** approach:

```
Defaulter's commitment (known to reporter) ─┐
                                              ├─► Prove commitment IS in tree
Expected roundId = hash(secret || round)     │   AND roundId is NOT in spent set
                                              │   → Reveals ONLY the defaulter's
                                              └►  commitment (not their identity)
```

Honest members who contributed have their `roundId` in `spentIdentifiers`. The reporter proves the defaulter's `roundId` is absent — without touching any honest member's data.

The commitment hash is published via `disclose()`. Mapping the hash to a real-world identity requires the organizer's off-chain record. The chain only reveals the hash.
