<div align="center">

# कोष

**All your finance. One place. Zero exposure.**

This project is built on the Midnight Network.

[App](https://app.kosh.finance) · [Docs](https://docs.kosh.finance) · [Website](https://kosh.finance) · [Twitter](https://x.com/kaborafinance)

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
│  Midnight Network (BLS12-377 zk-SNARKs)          │
│  NIGHT + DUST dual-token · LayerZero bridge      │
├─────────────────────────────────────────────────┤
│               SETTLEMENT LAYER                   │
│     Cardano (L1) · 50+ chains via LayerZero      │
└─────────────────────────────────────────────────┘
```

**The unifying insight:** Every module shares one **ZK Identity Merkle Tree**. A single KYC attestation — verified once, stored as a leaf — unlocks remittances (proves sender is verified), payroll (proves employee is authorized), circles (proves membership), credit scoring (proves identity without revealing it), and treasury access (proves signer authorization). This is the architectural moat.

## Save — ZK-ROSCA (Live on Preprod)

The **Save** module is the first milestone live on Midnight Preprod. It implements a fully private ROSCA (Rotating Savings and Credit Association) as a Compact smart contract.

**How it works:**
- A circle organizer deploys a contract with a fixed contribution amount, member cap (2–16), and round duration
- Members join by committing a ZK identity hash into an on-chain Merkle tree — no wallet address published
- Each round, every member contributes anonymously via a ZK proof of membership + nullifier
- Payouts rotate by join order — the member at slot N receives the full pool in round N, proven via Merkle path
- Completed circles generate a portable **participation receipt** — a ZK credential proving completion without revealing identity or circle address

**Privacy guarantees:**
- Contributions are unlinkable: no observer can determine which member contributed
- Payout claims are private: the recipient proves eligibility in-circuit; their identity never appears on-chain
- Only a defaulter's commitment hash is published on default — honest members remain fully anonymous

**Tech:**
- Contract: Compact (`rosca.compact`) — 5 circuits compiled to BLS12-377 zk-SNARKs
- Frontend: Next.js 14 App Router, deployed at [app.kosh.finance](https://app.kosh.finance)
- Network: Midnight Preprod (`preprod`) via Lace wallet

## Cross-Chain

Kosh is built natively on **Midnight Network**, which provides zero-knowledge privacy at the protocol level. Through **LayerZero** integration, Kosh connects to 50+ blockchains:

`Midnight` · `Cardano` · `Ethereum` · `Arbitrum` · `Solana` · `Base` · `Polygon` · `Avalanche` · `Optimism` · `BNB Chain` · and more

Send from any chain. Receive on any chain. Nothing leaks on any chain.

## Why Midnight?

Midnight is the only blockchain where **privacy is the default and disclosure is the choice**. Its Compact smart contract language compiles to ZK circuits — every variable is private unless explicitly published via the `disclose()` operator. This is the inverse of every other chain, where everything is public unless you bolt on privacy after the fact.

This matters because Kosh needs to be **compliant, not just private**. Midnight's selective disclosure model lets us prove "this transfer is under the reporting threshold and both parties are KYC-verified" without revealing who they are, how much was sent, or where it went. That's what regulators actually need.

## Repository Structure

```
kosh/
├── src/
│   ├── app/                  # Next.js 14 App Router (UI)
│   │   ├── circles/          # Circles pages: list, create, dashboard
│   │   ├── components/       # Shared UI components
│   │   ├── context/          # WalletContext (Lace connection)
│   │   └── hooks/            # useContract, useWallet
│   ├── contracts/
│   │   └── rosca.compact     # Compact ROSCA contract (5 circuits)
│   ├── dapp/
│   │   ├── interact.ts       # High-level contract interaction helpers
│   │   ├── witnesses.ts      # ZK witness implementations + private state
│   │   ├── lace-providers.ts # Browser SDK providers (Lace wallet)
│   │   └── providers.ts      # Environment config + provider factories
│   └── tests/                # Unit + integration tests (Jest)
├── website/                  # Docusaurus documentation site
│   └── docs/
│       ├── architecture/     # ADRs + architecture overviews
│       ├── contract/         # Compact contract reference
│       ├── dapp/             # SDK integration docs
│       └── getting-started/  # Setup + demo runbook
└── scripts/                  # Deploy + interact CLI scripts
```

## Getting Started

### Prerequisites

- Node.js 20+
- [Lace Midnight wallet](https://lace.io) configured for **Preprod** network
- tNIGHT and tDUST from [faucet.midnight.network](https://faucet.midnight.network)

### Run locally

```bash
git clone https://github.com/Kosh-Finance/kosh
cd kosh
npm install
cp .env.local.example .env.local   # fill in preprod endpoints (or use defaults)
npm run dev                         # http://localhost:3000
```

### Run tests

```bash
npm test          # unit tests (no network required)
```

The full end-to-end lifecycle test (`rosca.test.ts`) requires the local Midnight dev stack running — see [docs.kosh.finance/getting-started/running-the-app](https://docs.kosh.finance/getting-started/running-the-app).

### Deploy a circle

```bash
npx ts-node scripts/deploy.ts
```

## Market Context

- **$905B** — Global remittance flows annually. $44.5B extracted in fees at 6.5% average.
- **$500B+** — Estimated annual ROSCA volume worldwide. Zero builds formal credit today.
- **1.3B** — Adults still unbanked globally. 900M own a mobile phone.
- **$360B** — India's informal chit fund market alone (100x the registered sector).
- **0** — Existing ZK-ROSCA implementations anywhere. We built the first.

## Status

**Beta — live on Midnight Preprod** · App: [app.kosh.finance](https://app.kosh.finance) · Docs: [docs.kosh.finance](https://docs.kosh.finance)

| Module | Status |
|--------|--------|
| Save (ZK-ROSCA) | Live on Preprod |
| Send (remittances) | Planned — post-mainnet |
| Pay (payroll) | Planned — post-mainnet |
| Prove (credit score) | Planned — post-mainnet |
| Govern (treasury) | Planned — post-mainnet |
| Identity (KYC) | Planned — post-mainnet |

## Built by

**Kunal** — B.Tech CSE (Data Science), builder across Polkadot, Solana, Starknet, Arbitrum, and NEAR ecosystems. Background in computer security and applied cryptography.

Contract design: **Daksh** · Frontend: **Priya**

## Contact

**Email:** [kd@kosh.finance](mailto:kd@kosh.finance)  
**Website:** [kosh.finance](https://kosh.finance)

---

<div align="center">

**कोष** — *treasury for the people*

Built on [Midnight](https://midnight.network) · Powered by zero-knowledge proofs

</div>
