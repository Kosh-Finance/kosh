---
sidebar_position: 10
title: "ADR-001: Monolithic Contract"
---

# ADR-001: Monolithic Contract

**Status:** Accepted  
**Date:** 2024-11-01

## Context

Kosh requires several operations that share state: joining the circle, contributing per round, claiming payout, reporting a default, and generating a participation proof. These could be implemented as separate contracts (one per operation) communicating via on-chain messages, or as a single Compact contract with multiple circuits.

The Midnight SDK at the time of implementation does not support cross-contract calls in a way that preserves privacy guarantees between circuits. Splitting the logic across contracts would require leaking the link between a member's join action and their contribute/claim actions, which directly undermines the anonymity model.

## Decision

All five circuits (`joinCircle`, `contribute`, `claimPayout`, `reportDefault`, `generateParticipationProof`) are compiled into a single Compact contract (`rosca.compact`). They share a single ledger namespace and a single Merkle tree for the member set.

## Consequences

**Positive:**
- The shared ledger guarantees that membership, contribution tracking, and payout order are consistent across all circuit calls.
- The Merkle tree is a single authoritative source for membership — no cross-contract lookup needed.
- Deployment is a single transaction, simplifying the user flow and the deploy script.
- ZK proofs across circuits can reference the same ledger fields without any cross-contract trust assumptions.

**Negative:**
- The compiled contract binary grows with each additional circuit. With 5 circuits, compile times are longer (~30s) and verifier key files are larger.
- The entire contract must be redeployed for any logic change — no surgical upgrades. (Midnight does not yet support upgradeable contracts.)
- All circuits share the same private state type (`MemberPrivateState`), which requires careful use of transient fields (`pendingInCoin`, `pendingOutCoin`) to avoid stale data across calls.

## Alternatives Considered

**Multi-contract with shared Merkle root:** A registry contract holds the Merkle tree; individual operation contracts query it. Rejected because the indexer would need to resolve cross-contract state, and the ZK proof would need to prove the registry root at proof-time — adding significant complexity without privacy benefit.

**One circuit per deployment:** Each circle deployment is entirely self-contained. Accepted — this is what Kosh does. Each `deployCircle` call creates a fresh contract instance with its own ledger.
