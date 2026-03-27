---
sidebar_position: 99
title: Roadmap
---

# Roadmap

> **The core insight:** every completed ROSCA circle generates a private, verifiable proof of financial reliability. That proof is the bridge to everything else. The circle isn't just a savings product — it's a trust-building engine that unlocks progressively more sophisticated financial tools.

Kosh is a **community finance protocol**. Circles are the headline feature, not the only feature. The product vision is the entire informal finance stack — circles, reputation, lending, community pools — rebuilt with privacy.

---

## The Product Arc

```
Phase 1 (Now — Assemble)       Phase 2 (Post-Assemble)        Phase 3 (Growth)
──────────────────────────     ──────────────────────────     ──────────────────────

  ┌─────────────┐               ┌──────────────────────┐       ┌──────────────────┐
  │  ZK-ROSCA   │               │  ZK Reputation       │       │  Micro-Lending   │
  │  (Circles)  │ ──generates──►│  (Participation      │ ──enables► (Undercollater-│
  │             │               │   Proofs)             │       │   alized loans)  │
  └─────────────┘               └──────────────────────┘       └──────────────────┘
                                         │                              │
                                         ▼                              ▼
                                ┌──────────────────────┐       ┌──────────────────┐
                                │  Credit Tiers         │       │  Community Pools │
                                │  (Bronze → Silver     │       │  (Group lending, │
                                │   → Gold)             │       │  emergency funds)│
                                └──────────────────────┘       └──────────────────┘
                                         │                              │
                                         ▼                              ▼
                                ┌──────────────────────┐       ┌──────────────────┐
                                │  Higher-Value         │       │  Revenue:        │
                                │  Circles (unlocked    │       │  Interest spread,│
                                │  by reputation)       │       │  origination fees│
                                └──────────────────────┘       └──────────────────┘
```

---

## Phase 1 — Circles (Now: Assemble Program, Q1 2026)

This is the trust engine. Members join, contribute anonymously, receive payouts, and build private participation records. Every completed circle generates a ZK proof: *"I completed X/Y rounds."* This is the atomic unit of reputation.

**What's live:**
- Circle creation, private membership, anonymous contributions
- Round-robin payouts with ZK-enforced position verification
- Conditional default identification (only defaulter's commitment revealed)
- Portable participation proof generation
- Next.js frontend with Lace wallet integration on Midnight **preview** testnet
- Browser-native deployment via Lace (no Docker or local node required)
- Full test suite (unit + integration)

**Current constraints:**
- Preview testnet only (mainnet pending Midnight Hua phase)
- Max 16 members (compile-time Merkle tree depth)
- Round-robin payout only (no bidding)

---

## Phase 2 — ZK Reputation + Tiered Circles (Post-Assemble, Q2–Q3 2026)

Once participation proofs exist, reputation tiers emerge naturally.

### Credit Tiers

| Tier | Circles Completed | Contribution Rate | Unlocks |
|------|------------------|-------------------|---------|
| **New** | 0 | — | Small circles (4–8 members), low amounts |
| **Bronze** | 1–2 | 100% | Medium circles, reduced collateral |
| **Silver** | 3–5 | ≥95% | High-value circles, early payout positions |
| **Gold** | 5+ | ≥95% | Organize circles, micro-lending pools |

The key: all of this is provable via ZK proofs **without revealing which circles you completed, when, or with whom.** A Gold member proves *"I have completed 5+ circles with 100% contribution rate"* — nothing else. No history exposed.

### Reputation-Gated Circles

- New circles can require a minimum reputation tier to join
- Organizers set rules: *"This circle requires Silver tier or above"*
- Higher-value circles (larger contribution amounts) naturally require more trust
- **Reputation replaces collateral** — your track record IS your collateral

### Technical Milestones (Phase 2)

**Bid-based payout ordering** — members bid to receive earlier payout positions, creating a fair market for time preference. Mechanism: sealed-bid commitment scheme inside Compact circuits (commit bids → reveal phase → contract assigns order by bid size). Adds ~2× circuit complexity to `joinCircle`.

**Client-side ZK proofs (WASM)** — eliminate the proof server dependency by running proof generation in the browser. Witness data never leaves the user's machine at all. Dependent on Compact compiler WASM target support.

**Circle registry** — a lightweight Compact contract that indexes deployed circle addresses, enabling in-app discovery without sharing addresses out-of-band.

**Multiple member cap variants** — pre-compiled contracts for 4, 8, and 16-member circles; frontend selects the appropriate variant.

---

## Phase 3 — Community Micro-Lending (Growth, Q3 2026+)

Once a population of members with verifiable private reputation exists, peer finance becomes possible.

### Peer-to-Peer Micro-Loans

- A Gold-tier member can borrow from a community pool without full collateralization
- Loan terms set by reputation tier — better reputation means lower interest and higher loan amount
- Repayment feeds back into reputation: on-time repayment increases score, default decreases it
- **Private by design:** the lender knows *"this borrower is Gold tier"* but not who they are or their specific history

### Emergency Fund Pools

- Groups of circle members create a shared reserve
- Members contribute a small amount each month into the pool
- Any member can draw from the pool in an emergency, up to a limit set by their reputation tier
- This is how traditional ROSCAs actually evolve in practice — the academic literature calls these **ASCRAs** (Accumulating Savings and Credit Associations)

### Group Lending (Grameen-style)

- Groups of 5–10 members with established reputation co-guarantee each other's loans
- If one member defaults, the group absorbs the loss — creating strong social incentive for repayment
- Muhammad Yunus won the Nobel Prize for this model at massive scale
- Nobody has built a privacy-preserving version

### Revenue Model

| Phase | Revenue Source |
|-------|---------------|
| Phase 1 | Small platform fee on circle operations (0.1–0.3%) |
| Phase 2 | Premium access for higher-tier circles, organizer fees |
| Phase 3 | Interest spread on micro-loans (borrower pays 5%, lender earns 3%, Kosh keeps 2%), origination fees |

---

## Why This Path Works

**Each phase validates the next.** You don't need to guess whether micro-lending will work — you observe whether people actually complete circles and build reputation first. If Phase 1 gets traction, Phase 2 is obvious. If Phase 2 gets traction, Phase 3 is obvious.

**Money Fellows already proved it.** They started with circles → added credit scoring → launched a prepaid card → now planning lending, insurance, and payroll. Their CEO explicitly calls ROSCAs a $700B global opportunity. Kosh is building the same product arc with privacy and decentralization as structural advantages.

**The competitive moat deepens with each phase.** A competitor can copy the ROSCA contract. They cannot copy the reputation network. The more circles completed on Kosh, the more valuable the reputation proofs become, the harder it is to leave — but the user **owns their reputation** (portable ZK proofs), so it's not extractive lock-in.

---

## Mainnet Target (Midnight Hua Phase, Q3 2026)

Kosh will deploy to Midnight mainnet when:

1. Midnight Hua phase (full decentralization) is live and stable
2. Lace wallet supports mainnet
3. Security audit of Compact circuits is complete
4. Client-side proof generation is working

---

## Future Vision

- **Mobile app** — React Native with local proof server
- **Kosh Card** — debit card funded by savings circle payouts
- **Multi-currency circles** — when Midnight supports additional tokens
- **Fiat on/off ramp** — via partner integrations
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
- Money Fellows — ROSCA digitization case study
- Muhammad Yunus, *Banker to the Poor* (Grameen Bank model)
