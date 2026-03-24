---
sidebar_position: 2
title: Threat Model
---

# Threat Model

## Trusted Components

| Component | Trust Level | Reason |
|-----------|-------------|--------|
| Compact ZK circuits | **Trusted** | Compiled to formally verified Halo2 SNARKs |
| Midnight Network consensus | **Trusted** | Decentralized BFT consensus |
| User's local machine | **Trusted** | Witness functions execute locally; secrets stay local |
| Web Crypto API | **Trusted** | OS-level CSPRNG for secret generation |

## Untrusted Components

| Component | Trust Level | Concern |
|-----------|-------------|---------|
| Organizer | **Semi-trusted** | Holds off-chain commitment → identity mapping |
| Indexer GraphQL | **Untrusted for privacy** | Reads public ledger only; no secrets transmitted |
| Other circle members | **Untrusted** | Can see on-chain state but not individual identities |
| Proof server (Docker) | **Untrusted for data** | Receives circuit inputs; secrets must not be transmitted in future hosted deployments |

## Attack Analysis

### Passive On-Chain Observer

**Goal:** Identify which member made which contribution.

**Available data:** Merkle tree of commitments, set of nullifiers, pool balance updates.

**Result:** **Fails.** Nullifiers and commitments use different hash constructions. Linking them requires inverting a one-way Poseidon function — computationally infeasible.

---

### Malicious Organizer

**Goal:** Deanonymize all members.

**Available data:** The organizer may know which commitments belong to which members (they may have facilitated the off-chain joining process and seen which wallet submitted which join transaction).

**Result:** **Partial.** The organizer can link a commitment to a real-world identity. They **cannot** determine which member produced which round nullifier (because nullifiers use `persistentHash(secret || round)`, not the commitment, and the secret is never transmitted).

**Mitigation:** Use a trustless onboarding mechanism, or accept this as a known assumption (social trust in the organizer, as in traditional ROSCAs). A future upgrade can implement an optional organizer-encrypted member record.

---

### Member Collusion Attack

**Goal:** Multiple members collude to identify who contributed or defaulted in a given round.

**Available data:** Their own secrets, on-chain nullifiers, on-chain commitments.

**Result:** **Limited.** Colluding members know their own `(secret, nonce)` pairs and can verify each other's commitments. But they cannot determine *other* members' secrets from public on-chain data alone — they would need to know the target's secret.

**Mitigation:** Standard membership limits (≤16 members) limit the attack surface. ZK proofs remain valid regardless of colluding members.

---

### Timing Analysis

**Goal:** Link contribution timing to identity (e.g., "member X always contributes within 5 minutes of a round opening").

**Risk level:** Medium. If members contribute in highly predictable patterns (always first, always last), timing may leak partial information.

**Mitigation:** Encourage members to use randomized contribution timing within the round window. Future UI can add a "random delay" option.

---

### Replay Attack

**Goal:** Submit a previously valid contribution proof again to double-claim.

**Result:** **Fails.** The nullifier (`roundId`) is added to `spentIdentifiers` on first use. Resubmitting the same proof would fail `assert !spentIdentifiers.member(roundId)` — the transaction is rejected.

---

### Double-Contribution Attack

**Goal:** Contribute twice in the same round to drain the pool or disrupt the round.

**Result:** **Fails.** The nullifier is deterministic per (member, round) pair. The second attempt produces the same `roundId` which is already in `spentIdentifiers`. The assertion fails and the proof is rejected.

---

### Non-Member Contribution Attack

**Goal:** Contribute without being a registered member to steal from the pool or disrupt a round.

**Result:** **Fails.** The contribution circuit requires a valid Merkle membership proof. Without knowing a valid `(secret, nonce)` pair that maps to a leaf in the tree, the proof cannot be generated. The prover cannot forge a valid ZK proof.

---

### Wrong-Round Payout Claim

**Goal:** Claim the payout in a round that isn't yours (stealing someone else's payout).

**Result:** **Fails.** The `claimPayout` circuit verifies `leafIndex(memberMerklePath()) == currentRound`. The proof fails if the member's position doesn't match the current round. No other member's proof would validate for a different round.
