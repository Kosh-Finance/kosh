---
sidebar_position: 12
title: "ADR-003: Round-Robin Payouts"
---

# ADR-003: Round-Robin Payout Order

**Status:** Accepted  
**Date:** 2024-11-01

## Context

In a ROSCA, each member receives the pool exactly once. The order in which members receive the pool must be:

1. **Deterministic** — all participants agree on who gets paid in each round without off-chain coordination.
2. **Private** — ideally, observers cannot determine in advance who will receive the pool in a given round.
3. **Verifiable** — the recipient must prove they are the legitimate recipient for the current round without revealing their identity to non-participants.

Common ROSCA variants use random order (lottery), bidding (Dutch auction), or first-joined order. Midnight's ZK constraints make random order difficult — the circuit would require a verifiable random function (VRF) with a publicly verifiable seed, which adds significant circuit complexity.

## Decision

Payout order follows join order: the member who joins at leaf index `n` receives the payout in round `n`. This is stored in the `payoutOrder` map (`Map<Uint<8>, Bytes<32>>`), which records `round → commitment` at join time.

In `claimPayout`, the circuit checks:
```
payoutOrder.lookup(currentRound) == commitment
```
where `commitment = persistentCommit(memberSecret, memberNonce)`. This proves the caller is the correct recipient without revealing which physical member holds that leaf index.

## Consequences

**Positive:**
- The payout order is fully deterministic from the join transaction sequence. No randomness, no off-chain coordination, no organizer decision.
- The ZK proof in `claimPayout` is a simple Merkle path + hash preimage check — no VRF circuit needed.
- Early members know they will receive earlier payouts, which is a natural incentive to join quickly.
- The `payoutOrder` map provides a public audit trail: anyone can verify that the commitment at `round N` received the payout for round N.

**Negative:**
- Join order is predictable — the first joiner always gets round 0. This is visible on-chain (though their identity is not). Sophisticated observers could attempt correlation attacks if they control which wallet connects first.
- No fair random selection. Some ROSCA traditions use lotteries to distribute liquidity benefit fairly.
- If a member in an early slot defaults, later-slot members must wait through the reporting / recovery process, or the circle fails entirely.

## Alternatives Considered

**Lottery (VRF-based):** Each round, a verifiable random function selects the recipient. Compact does not currently expose a built-in VRF; implementing one in-circuit would be large and expensive. Deferred to a future version.

**Bidding (Dutch auction):** Members bid DUST to move up in the payout order. Adds an auction circuit and DUST denomination complexity. Out of scope for the MVP.

**Organizer-assigned order:** The deployer assigns payout order off-chain and commits it at deploy time. Rejected because it requires trusting the organizer not to front-run, and it complicates the join flow.
