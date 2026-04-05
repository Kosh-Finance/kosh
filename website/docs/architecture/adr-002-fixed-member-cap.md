---
sidebar_position: 11
title: "ADR-002: Fixed Member Cap"
---

# ADR-002: Fixed Member Cap at Deploy Time

**Status:** Accepted  
**Date:** 2024-11-01

## Context

A ROSCA circle needs a defined pool size: the payout amount is `contributionAmount × memberCount`. There are two approaches:

1. **Open membership:** anyone can join until a deadline; pool size is known only after the join window closes.
2. **Fixed cap:** the deployer sets `memberCap` at deployment; the circle starts when all slots are filled.

The Midnight ZK model requires that Merkle tree depth be fixed at compile time (the tree type is `MerkleTree<4, Bytes<32>>`, a depth-4 tree for up to 16 members). The circuit must prove a path of exactly this depth for every member operation. Dynamic membership would require circuit variants for each possible tree depth, or a large fixed tree with dummy nodes — both undesirable.

## Decision

`memberCap` is a constructor parameter (range 2–16, matching the depth-4 Merkle tree capacity). The contract transitions from `OPEN` to `ROUND_IN_PROGRESS` automatically when `memberCount` reaches `memberCap`. Late joins are rejected by the circuit (`assert(memberCount < memberCap)`).

## Consequences

**Positive:**
- Payout amount is fully determined at deploy time — no surprises for members.
- Merkle tree depth is fixed, which is required by the Compact circuit. All Merkle path proofs have exactly 4 siblings.
- The join window is self-closing: no deadline vote or organizer action is needed to start the first round.
- Simpler UX: the deployer communicates `contributionAmount`, `memberCap`, and `roundDuration` upfront. Members know exactly what they're joining.

**Negative:**
- Circles can get "stuck" waiting for the last slot if potential members change their minds. There is no mechanism to eject a non-joining member or reduce `memberCap` post-deploy.
- Cap is limited to 16 (depth-4 tree). Larger circles require recompiling the contract with a deeper tree.
- If fewer than `memberCap` members join, the circle never starts. Organizers must redeploy.

## Alternatives Considered

**Dynamic cap with a commit-reveal join:** Members commit to joining off-chain, then reveal on-chain during a fixed window. Rejected due to complexity and the fact that it does not solve the stuck-circle problem.

**Large tree with dummy nodes:** Deploy with a depth-8 tree (256 members) but allow fewer members to participate. Rejected because: (a) Merkle paths would be 8 levels deep for every proof, increasing proof time significantly; (b) dummy nodes complicate the membership check in `contribute` and `claimPayout`.
