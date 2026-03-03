<div align="center">

# कोष

**All your finance. One place. Zero exposure.**

[Website](https://kosh.finance) · [Docs](https://docs.kosh.finance) · [Twitter](https://x.com/kaborafinance) · [Get Early Access](https://kosh.finance)

---

</div>

Your crypto finances are scattered across 10 apps. Your identity is copied 10 times. Your salary is on Etherscan. Your savings circles run on WhatsApp. And none of it builds credit.

**Kosh** (कोष — Hindi/Sanskrit for *treasury, vault, fund*) is a unified, cross-chain finance platform built on [Midnight Network](https://midnight.network). Six modules. One ZK identity. Every chain. Private by default. Compliant by design.

## The Problem

Every financial action in crypto lives in a different app — remittances on Wise, payroll on Coinshift, treasury on Gnosis Safe, savings circles on WhatsApp, credit scoring nowhere. Each one demands separate KYC, exposes different data on-chain, and builds zero portable reputation.

You're paying a **fragmentation tax** in fees, privacy leaks, and lost opportunity every single day.

## What Kosh Does

| Module | What It Does | Why It Matters |
|--------|-------------|----------------|
| **Send** | Private cross-border remittances | Shielded stablecoin transfers — amounts and identities hidden, compliance proofs satisfy regulators |
| **Pay** | Confidential payroll disbursements | Batch payroll in shielded stablecoins — only aggregate totals on-chain, individual salaries private |
| **Save** | ZK-private savings circles (ROSCA) | The world's first ZK-ROSCA — anonymous contributions, fair payouts, conditional deanonymization on default |
| **Prove** | Privacy-preserving credit scoring | Every action builds a ZK Credit Score — prove creditworthiness without revealing history |
| **Govern** | Private DAO treasury + multi-sig | Hidden signers, shielded balances, ZK quorum proofs — approvals provable, identities protected |
| **Identity** | Verify once, use everywhere | Single KYC attestation becomes a Merkle leaf — one identity unlocks all modules across all chains |

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   USER LAYER                     │
│         Mobile App · Web Dashboard · SDK         │
├─────────────────────────────────────────────────┤
│                APPLICATION LAYER                 │
│   Send · Pay · Save · Prove · Govern · Identity  │
├─────────────────────────────────────────────────┤
│                 PRIVACY LAYER                    │
│  Compact Contracts · ZK Identity Merkle Tree     │
│  Zswap Shielded Coins · Proof Server             │
├─────────────────────────────────────────────────┤
│                PROTOCOL LAYER                    │
│  Midnight Network (BLS12-381 zk-SNARKs)          │
│  NIGHT + DUST dual-token · LayerZero bridge      │
├─────────────────────────────────────────────────┤
│               SETTLEMENT LAYER                   │
│     Cardano (L1) · 50+ chains via LayerZero      │
└─────────────────────────────────────────────────┘
```

**The unifying insight:** Every module shares one **ZK Identity Merkle Tree**. A single KYC attestation — verified once, stored as a leaf — unlocks remittances (proves sender is verified), payroll (proves employee is authorized), circles (proves membership), credit scoring (proves identity without revealing it), and treasury access (proves signer authorization). This is the architectural moat.

## Cross-Chain

Kosh is built natively on **Midnight Network**, which provides zero-knowledge privacy at the protocol level. Through **LayerZero** integration, Kosh connects to 50+ blockchains:

`Midnight` · `Cardano` · `Ethereum` · `Arbitrum` · `Solana` · `Base` · `Polygon` · `Avalanche` · `Optimism` · `BNB Chain` · and more

Send from any chain. Receive on any chain. Nothing leaks on any chain.

## Why Midnight?

Midnight is the only blockchain where **privacy is the default and disclosure is the choice**. Its Compact smart contract language compiles to ZK circuits — every variable is private unless explicitly published via the `disclose()` operator. This is the inverse of every other chain, where everything is public unless you bolt on privacy after the fact.

This matters because Kosh needs to be **compliant, not just private**. Midnight's selective disclosure model lets us prove "this transfer is under the reporting threshold and both parties are KYC-verified" without revealing who they are, how much was sent, or where it went. That's what regulators actually need.

## Market Context

- **$905B** — Global remittance flows annually. $44.5B extracted in fees at 6.5% average.
- **$500B+** — Estimated annual ROSCA volume worldwide. Zero builds formal credit today.
- **1.3B** — Adults still unbanked globally. 900M own a mobile phone.
- **$360B** — India's informal chit fund market alone (100x the registered sector).
- **0** — Existing ZK-ROSCA implementations anywhere. We're building the first.

## Status

🔨 **In active development** — building on Midnight testnet ahead of mainnet launch (late March 2026).


## Built by

**Kunal** — B.Tech CSE (Data Science), builder across Polkadot, Solana, Starknet, Arbitrum, and NEAR ecosystems. Background in computer security and applied cryptography.

## Contact

**Email:** [kd@kosh.finance](mailto:kd@kosh.finance)
**Website:** [kosh.finance](https://kosh.finance)

---

<div align="center">

**कोष** — *treasury for the people*

Built on [Midnight](https://midnight.network) · Powered by zero-knowledge proofs

</div>
