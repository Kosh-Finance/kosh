<div align="center">

# कोष · Kosh

**The world's first ZK-ROSCA — private savings circles on Midnight Network.**

This project is built on the Midnight Network.

[App](https://app.kosh.finance) · [Docs](https://docs.kosh.finance) · [Website](https://kosh.finance) · [Twitter](https://x.com/koshfinance)

---

</div>

## What it is right now

Kosh is a **live beta dApp on Midnight Preprod** that lets anyone run a private savings circle (ROSCA) entirely on-chain — where contributions, identities, and payout recipients are hidden behind ZK proofs.

A ROSCA (*Rotating Savings and Credit Association*) is one of the oldest financial instruments in the world. A group pools money each round; one member takes the full pot. Repeat until everyone has received once. Billions of people use informal ROSCAs today — through WhatsApp groups, on trust, with zero accountability and no credit trail.

Kosh makes them trustless, anonymous, and on-chain. For the first time.

**Try it:** [app.kosh.finance](https://app.kosh.finance) — connect Lace wallet (Midnight Preprod), deploy a circle, invite members, start saving.

---

## How it works

**1. Deploy a circle**

Set a contribution amount (in NIGHT), a member cap (2–16), and a round duration. One transaction. One contract address to share.

**2. Join anonymously**

Each member's wallet generates a secret and commits `H(secret, nonce)` into an on-chain Merkle tree. No name. No address. Just a hash.

**3. Contribute each round**

To contribute, a member generates a ZK proof that proves:
- they hold a secret corresponding to a leaf in the Merkle tree
- they have not already contributed this round (nullifier)

The proof is verified on-chain. No one — not the contract, not the indexer, not other members — can tell who contributed.

**4. Claim your payout**

Payout order follows join order (slot 0 gets round 0, slot 1 gets round 1, etc.). To claim, the recipient proves in-circuit that their Merkle position matches the current round. The payout is shielded — the recipient's identity is never published.

**5. Participation receipt**

When a circle completes, each member can generate a 32-byte receipt: `H(memberSecret, contractAddress)`. This is a portable ZK credential — proof that you completed a savings circle, without revealing which one or who you are.

---

## Privacy model

| What happens | What's on-chain | What's private |
|---|---|---|
| Member joins | Commitment hash | Secret, nonce, wallet address |
| Member contributes | ZK proof (valid) | Which member contributed |
| Payout claimed | ZK proof (valid) | Who received the payout |
| Default reported | Defaulter's commitment hash | All honest members' identities |
| Participation receipt | Nothing (off-chain) | Circle address, member identity |

Honest members are **unconditionally anonymous** — even if a defaulter is identified, their exposure does not compromise anyone else.

---

## Tech

| Layer | Detail |
|---|---|
| Contract | `rosca.compact` — 5 circuits (`joinCircle`, `contribute`, `claimPayout`, `reportDefault`, `generateParticipationProof`) |
| ZK scheme | BLS12-377 zk-SNARKs via Midnight's Compact compiler |
| Private state | Poseidon2 Merkle tree (depth 4, up to 16 members) · member secrets stored locally in browser |
| Frontend | Next.js 14 App Router · Lace wallet via `@midnight-ntwrk/dapp-connector-api` |
| Network | Midnight Preprod · Indexer + Proof Server at `*.preprod.midnight.network` |

---

## Repository structure

```
kosh/
├── src/
│   ├── app/                  # Next.js 14 App Router (UI)
│   │   ├── circles/          # Circle list, create, and dashboard pages
│   │   ├── components/       # StatusBadge, RoundTracker, ZkProofSpinner, ...
│   │   ├── context/          # WalletContext — Lace connection + APIError handling
│   │   └── hooks/            # useContract, useWallet
│   ├── contracts/
│   │   └── rosca.compact     # Compact ROSCA contract source
│   ├── dapp/
│   │   ├── interact.ts       # contribute(), claimPayout(), joinCircle(), ...
│   │   ├── witnesses.ts      # ZK witnesses + MemberPrivateState schema
│   │   ├── lace-providers.ts # Browser SDK providers (Bech32m key decode, balanceTx)
│   │   └── providers.ts      # ENV config + provider factories
│   └── tests/                # Jest unit tests (132 passing, no network required)
├── website/                  # Docusaurus docs site (docs.kosh.finance)
│   └── docs/
│       ├── architecture/     # 4 ADRs: monolithic contract, fixed cap, round-robin, receipts
│       ├── contract/         # Compact circuit reference
│       ├── dapp/             # SDK integration guide
│       └── getting-started/  # Setup, prerequisites, demo runbook
└── scripts/                  # deploy.ts, interact.ts CLI scripts
```

---

## Getting started

### Prerequisites

- Node.js 20+
- [Lace Midnight wallet](https://lace.io) — configured for **Preprod** network
- tNIGHT and tDUST from [faucet.midnight.network](https://faucet.midnight.network)

### Run locally

```bash
git clone https://github.com/Kosh-Finance/kosh
cd kosh
npm install
npm run dev        # http://localhost:3000
```

Environment defaults to Midnight Preprod endpoints. Override in `.env.local` if needed.

### Run tests

```bash
npm test           # 132 unit tests, no network required
```

### Deploy a circle from CLI

```bash
npx ts-node scripts/deploy.ts
```

---

## The vision

Kosh starts with savings circles because they are the most universal, most underserved financial primitive in the world — and the one where ZK proofs add the most value. But savings circles are just the beginning.

The long-term architecture: **one ZK identity, six financial modules, every chain**.

| Module | What | When |
|--------|------|------|
| **Save** | ZK-ROSCA savings circles | **Live on Preprod** |
| **Send** | Private cross-border remittances | Post-mainnet |
| **Pay** | Confidential payroll | Post-mainnet |
| **Prove** | ZK credit scoring from on-chain history | Post-mainnet |
| **Govern** | Private DAO treasury + multi-sig | Post-mainnet |
| **Identity** | Single KYC attestation, reusable everywhere | Post-mainnet |

The unifying insight: every module shares one **ZK Identity Merkle Tree**. Join a savings circle → your membership proof becomes a credit data point. Receive payroll → your income is provable without being public. Complete KYC once → the attestation works across every module, every chain, without re-exposing your documents. This compounding of privacy-preserving reputation is what no existing financial app can do.

**Market context:**
- $905B in annual global remittances, with $44.5B extracted in fees
- $500B+ in annual ROSCA volume worldwide — zero of it builds formal credit
- $360B in India's informal chit fund market alone
- 1.3B unbanked adults globally, 900M of whom own a mobile phone
- 0 ZK-ROSCA implementations before this one

---

## Why Midnight?

Midnight is the only blockchain where **privacy is the default and disclosure is the choice**. In Compact (Midnight's contract language), every variable is shielded unless explicitly published with `disclose()`. This is the inverse of every other chain.

For Kosh this is not an aesthetic preference — it is a product requirement. A savings circle where contributions are publicly linkable is not private. A credit score that exposes your history defeats the purpose. Midnight's selective disclosure model lets Kosh prove compliance ("this member is KYC-verified, this amount is under the reporting threshold") without revealing identity, amount, or history. That is what regulators actually need, and what users actually deserve.

---

## Built by

**Kunal** — B.Tech CSE (Data Science). Builder across Polkadot, Solana, Starknet, Arbitrum, and NEAR. Background in computer security and applied cryptography.

Contract design: **Daksh** · Frontend: **Priya**

**Email:** [kd@kosh.finance](mailto:kd@kosh.finance) · **Website:** [kosh.finance](https://kosh.finance)

---

<div align="center">

**कोष** — *treasury for the people*

Built on [Midnight](https://midnight.network) · Powered by zero-knowledge proofs

</div>
