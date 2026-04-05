---
sidebar_position: 5
title: Demo Runbook
---

# Demo Runbook — 5-Minute Scripted Flow

This runbook describes a fast, repeatable demonstration of Kosh on the Midnight preprod network. It is designed for showcases, investor demos, and beta onboarding sessions. End-to-end runtime is approximately 5 minutes assuming Lace is already configured.

## Prerequisites

| Item | Required |
|------|----------|
| Chrome browser | Yes |
| Lace Midnight extension | Yes — download from [lace.io](https://lace.io) |
| Lace configured for **Preprod** network | Yes |
| tNIGHT and tDUST balances | Yes — from [faucet.midnight.network](https://faucet.midnight.network) |
| Two Lace accounts (for multi-member demo) | Recommended |

**Quickcheck:** Open Lace, confirm it shows "Preprod" in the network selector and a non-zero tNIGHT balance. If not, get tokens from the faucet before proceeding.

---

## Step 1 — Connect Wallet (30 seconds)

1. Open [app.kosh.finance](https://app.kosh.finance) in Chrome.
2. Click **Connect Wallet** in the top-right navigation bar.
3. The Lace popup appears — click **Approve**.
4. The navbar displays your tNIGHT and tDUST balances.

**Talking point:** *"Kosh connects to the Lace wallet you already have. Nothing is installed on the server — all sensitive data stays on your device."*

---

## Step 2 — Deploy a Circle (90 seconds)

1. Click **Circles → New Circle** in the navigation.
2. Fill in the form:
   - **Contribution amount:** `1` (= 1 NIGHT per round)
   - **Member cap:** `2` (fastest for demo — only 2 members needed)
   - **Round duration:** `3600` (1 hour, so the deadline doesn't expire mid-demo)
3. Click **Deploy Circle**.
4. Lace shows a transaction approval popup — click **Sign & Submit**.
5. Wait ~20–40 seconds. A contract address appears in the confirmation step.

**Talking point:** *"This is a standard Midnight transaction. The circle contract is now live on the preprod testnet. The address is the only thing that's public — the member identities and contributions are private."*

6. Copy the contract address. You'll share it with the second participant.

---

## Step 3 — Join as Member 1 (30 seconds)

After deploy, you are not automatically a member. To join:

1. Navigate to **Circles → [paste your address]** or click the address link from the deploy confirmation.
2. Click **Join circle**.
3. Lace approval popup — click **Sign & Submit**.
4. Wait ~15–30 seconds. The sidebar updates: **Slot 0 · Payout round 0**.

**Talking point:** *"Joining inserts a cryptographic commitment into an on-chain Merkle tree. The commitment is a ZK hash of your secret. No wallet address, no name — just a hash."*

---

## Step 4 — Member 2 Joins (30 seconds)

On a second device or browser profile with a different Lace account:

1. Open [app.kosh.finance](https://app.kosh.finance) → **Connect Wallet**.
2. Go to **Circles** → paste the circle address from Step 2.
3. Click **Join circle** → Lace approval → wait for confirmation.
4. Both participants now see **Members: 2 / 2** and the circle status changes to **ROUND IN PROGRESS**.

**Talking point:** *"The circle sealed automatically when the last slot filled. No organizer action required. The smart contract handles the transition."*

---

## Step 5 — Contribute (60 seconds)

Both members must contribute in the current round.

**Member 1:**
1. Click **Contribute 1 NIGHT** → Lace approval → wait ~30–60 seconds.

**Member 2 (second device):**
1. Click **Contribute 1 NIGHT** → Lace approval → wait ~30–60 seconds.

Once both contribute, the status changes to **PAYOUT PENDING**.

**Talking point:** *"Each contribution is a ZK proof that: (a) the sender is a member, (b) they haven't contributed this round before. No one can link the contribution to a specific wallet — not the other member, not the indexer."*

---

## Step 6 — Claim Payout (60 seconds)

Member 1 (slot 0) is the recipient for round 0.

1. Member 1 sees **Your payout is ready** — **2 NIGHT** (= 2 members × 1 NIGHT).
2. Click **Claim 2 NIGHT** → Lace approval → wait ~20–40 seconds.
3. Member 1's tNIGHT balance increases by 2 NIGHT.
4. Circle status advances to round 1, status returns to **ROUND IN PROGRESS**.

**Talking point:** *"The payout proof verifies: (a) all members contributed, (b) the claimer's Merkle position matches the current round. The recipient's identity is hidden behind a ZK proof — even the contract doesn't know which wallet is claiming."*

---

## Step 7 — Generate Participation Receipt (30 seconds)

After all rounds complete (for a 2-member circle, 2 rounds total):

1. Navigate to the circle address.
2. Click **Generate participation proof**.
3. A 32-byte receipt appears in the UI.
4. Click **Copy receipt**.

**Talking point:** *"This receipt proves 'I completed a savings circle' without revealing which circle or who you are. It's a portable ZK credential — future Midnight dApps can verify it on-chain as a credit signal."*

---

## Timing Summary

| Step | Action | Time |
|------|--------|------|
| 1 | Connect wallet | ~30s |
| 2 | Deploy circle | ~30–40s |
| 3 | Member 1 joins | ~15–30s |
| 4 | Member 2 joins | ~15–30s |
| 5 | Both contribute | ~60–120s |
| 6 | Claim payout | ~20–40s |
| 7 | Participation receipt | ~15–25s |
| **Total** | | **~3–5 min** |

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| "Lace Midnight extension not found" | Make sure Lace is installed and enabled for `app.kosh.finance` |
| "Wrong network" error | Switch Lace to **Preprod** network in wallet settings |
| "Low DUST balance" warning | Get tDUST from [faucet.midnight.network](https://faucet.midnight.network) — each transaction requires DUST for fees |
| Proof generation stalls > 2 minutes | Check network connectivity; the proof server is at `proof-server.preprod.midnight.network` |
| Circle stuck in OPEN | Second member needs to join; share the address from Step 2 |
