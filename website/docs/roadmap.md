---
sidebar_position: 99
title: Roadmap
---

# Roadmap

## Current: Assemble Program (Q1 2026)

The current release implements the core ZK-ROSCA mechanics on Midnight's local development network.

**What's live:**
- Circle creation, private membership, anonymous contributions
- Round-robin payouts with ZK-enforced position verification
- Conditional default identification (only defaulter's commitment revealed)
- Portable participation proof generation
- Next.js frontend with Lace wallet integration
- Full test suite (108 tests: unit + integration)

**Constraints:**
- Local dev only (network ID `undeployed`)
- Max 16 members (compile-time Merkle tree depth)
- Round-robin payout only (no bidding)
- Single compiled variant (4-16 member circles)

---

## Post-Assemble (Q2–Q3 2026)

### Bid-Based Payout Ordering

Members bid to receive earlier payout positions, creating a fair market for time preference.

**Mechanism:** Sealed-bid commitment scheme inside Compact circuits:
1. Members commit bids: `persistentCommit(bidAmount, bidNonce)` — hidden during bidding
2. After all bids submitted: reveal phase publishes bid amounts
3. Contract assigns payout order by bid size

**Challenge:** Adds ~2× circuit complexity to `joinCircle`. Proof generation time will increase.

### Client-Side ZK Proofs (WASM)

Eliminate the proof server dependency by running proof generation in the browser via WebAssembly. This is the correct production architecture — witness data never leaves the user's machine at all (no HTTP call to proof server).

**Status:** Dependent on Compact compiler WASM target support.

### Circle Registry

A lightweight registry contract that indexes deployed circle addresses:

```compact
export circuit registerCircle(circleAddress: Bytes<32>): []
export circuit listCircles(): Vector<Bytes<32>>
```

Enables in-app circle discovery without sharing addresses out-of-band.

### Multiple Member Cap Variants

Pre-compile and deploy contract variants for common circle sizes:

| Variant | Max Members | Merkle Depth |
|---------|-------------|-------------|
| `rosca-small` | 4 | 2 |
| `rosca-medium` | 8 | 3 |
| `rosca-large` | 16 | 4 |

The frontend selects the appropriate variant based on the chosen member cap.

### ZK Credit Score Module

Use participation proofs from completed circles as privacy-preserving credit signals:

```
User has 5 completed circle proofs
→ "Completed 5 savings circles, 100% contribution rate"
→ Lender verifies without learning which circles or who the user is
→ Better loan terms
```

Integration path: standalone Compact contract that aggregates participation receipts into a credit score proof.

### Mainnet Deployment (Midnight Hua Phase, Q3 2026)

Midnight mainnet is targeted for Q3 2026 (Hua phase — full decentralization). Kosh will deploy when:

1. Mainnet is live and stable
2. Lace wallet supports mainnet
3. Security audit of Compact circuits is complete
4. Client-side proof generation is working

---

## Future Vision

- **Mobile app** (React Native + local proof server)
- **Multi-currency circles** (when Midnight supports additional tokens)
- **Fiat on/off ramp** (via partner integrations)
- **Kosh Card** — debit card funded by savings circle payouts
- **Cross-chain participation** — if Midnight bridges become available
- **DAO treasury module** — organizational savings using circle mechanics

---

## References

- [Midnight Developer Docs](https://docs.midnight.network/)
- [Compact Language Reference](https://docs.midnight.network/develop/reference/compact/lang-ref)
- [Zswap Protocol — ePrint 2022/1002](https://eprint.iacr.org/2022/1002)
- [Halo2 Proof System](https://zcash.github.io/halo2/)
- B-ROSCA: Blockchain-based ROSCA — IEEE DAPPS 2023
- ChitChain — Springer 2021
