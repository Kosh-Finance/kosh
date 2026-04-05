---
sidebar_position: 13
title: "ADR-004: Participation Receipt"
---

# ADR-004: Participation Receipt Design

**Status:** Accepted  
**Date:** 2024-11-01

## Context

A completed Kosh circle creates a valuable social signal: a member demonstrated financial reliability by contributing on time for every round. This signal could be useful as a reputation primitive — e.g., for undercollateralized lending or DeFi credit scoring.

However, revealing which circles a user participated in, or linking their on-chain address to a circle's contract address, breaks the privacy model that Kosh is built on. The receipt must prove participation **without** revealing:
- Which circle was completed
- The user's shielded or transparent address
- The user's leaf index (payout round)
- The payout amount they received

## Decision

The `generateParticipationProof` circuit produces a 32-byte receipt by computing:

```
receipt = persistentHash(memberSecret || contractAddress)
```

This is a Poseidon2 hash over the member's secret and the contract address. It is:
- **Unique per member per circle** — two members in the same circle get different receipts.
- **Not linkable to identity** — without knowing the member's secret, the receipt reveals nothing.
- **Verifiable by the member** — they can recompute it at any time with their private state.
- **Non-transferable** — a receipt cannot be forged by a non-participant.

The receipt is returned as a private circuit output. It is not published on-chain. The member stores it locally (in the browser's `localStorage` under `kosh:receipts`).

## Consequences

**Positive:**
- The receipt is a compact, shareable proof of ROSCA completion with no on-chain footprint.
- No new ledger storage or transaction required beyond the circuit call.
- Future verifier contracts on Midnight could accept the receipt as an anonymous credential — verify the Poseidon2 preimage without learning which circle or identity it corresponds to.
- The receipt is reproducible: if the user loses `localStorage`, they can regenerate it by running `generateParticipationProof` again against the same contract.

**Negative:**
- The receipt is currently off-chain and self-asserted. A verifier must trust that the ZK proof was actually generated (or build a verifier contract that checks the proof on-chain).
- `localStorage` is ephemeral across browsers/devices. Users must manually back up receipts if they want portability.
- Receipt alone doesn't prove *how many* rounds were completed or the contribution amount — only that the circle was completed. Richer credentials (amount, round count) would require additional circuit outputs.

## Alternatives Considered

**On-chain receipt NFT:** Mint an NFT as a completion certificate. Rejected because NFT minting is linkable to the minter's address and creates a public record of which contract was completed — breaks privacy.

**Merkle-based credential tree:** Accumulate receipts in a global Merkle tree for cross-circle verification. Deferred — requires a separate registry contract and circuit, which is out of scope for the MVP.

**No receipt:** Simply allow members to prove membership by rerunning the Merkle proof. Rejected because Merkle proofs are specific to a circle address (observable), whereas the receipt design decouples the proof from the contract address.
