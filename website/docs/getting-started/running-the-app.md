---
sidebar_position: 4
title: Running the App
---

# Running the App

Kosh runs entirely in the browser at [app.kosh.finance](https://app.kosh.finance). No Docker, no local node, no command-line setup required.

## End-to-End Walkthrough

### 1. Connect Lace

Open [app.kosh.finance](https://app.kosh.finance) in Chrome. Click **Connect Wallet** in the top-right navigation bar.

Kosh polls for the Lace Midnight extension (up to 8 seconds). Once detected, it calls `lace.connect('preprod')` and requests permission to read your shielded address. Approve the connection in the Lace popup.

The navbar shows your NIGHT and DUST balances once connected.

:::tip Brave browser
If using Brave, disable shields for `app.kosh.finance` — Brave's aggressive content blocking can prevent extension injection.
:::

### 2. Create a Circle

Navigate to **Circles → New Circle**.

| Field | Description | Example |
|-------|-------------|---------|
| Contribution amount | Fixed NIGHT per member per round | `1 NIGHT` |
| Member cap | Maximum members (2–16) | `4` |
| Round duration | Time window per round in seconds | `86400` (1 day) |

Click **Deploy Circle**. This runs `deployFromBrowser()` entirely in the browser:

1. Loads ZK artifacts from `/build/` (served statically from the app)
2. Creates browser-native providers backed by your connected Lace wallet
3. Calls `deployContract()` from the Midnight SDK
4. Lace shows an approval popup — sign and submit the transaction
5. Returns a contract address once the transaction is indexed

**Expect:** ~20–40 seconds including proof generation and on-chain confirmation.

:::info Preprod network
All circles are deployed on Midnight's public **preprod** testnet. NIGHT and DUST are test tokens with no real value. Get them from the [Midnight faucet](https://faucet.midnight.network).
:::

### 3. Join a Circle

Share the contract address with participants. Each member:

1. Goes to **Circles → [paste address]** or navigates to the circle detail page
2. Clicks **Join Circle**

Joining:
- Generates a fresh member secret + nonce locally in the browser
- Computes `commitment = persistentCommit(secret, nonce)`
- Submits a ZK proof that inserts the commitment into the on-chain Merkle tree
- Saves the secret to browser memory (private state)

**Expect:** ~15–30s proof generation time.

When the last slot fills, the circle auto-transitions from `OPEN` → `ROUND_IN_PROGRESS`.

:::warning Back up your secret
The member secret is held in browser memory during the session. If you close the tab, you will need to re-join or restore from a backup. A persistent export feature is on the roadmap.
:::

### 4. Contribute

During each `ROUND_IN_PROGRESS` phase, all members must contribute before the round deadline.

Click **Contribute**. This:

1. Loads your member secret from in-memory private state
2. Computes a round-specific nullifier: `persistentHash(secret || roundNumber)`
3. Verifies membership via Merkle path
4. Transfers `contributionAmount` NIGHT to the contract pool

**Expect:** ~30–60s proof generation (most complex circuit).

### 5. Claim Payout

When all members contribute, the circle status transitions to `PAYOUT_PENDING`. The member whose leaf index matches the current round number sees a **Claim Payout** button.

Claiming proves your Merkle position and receives `contributionAmount × memberCount` NIGHT.

### 6. Repeat

The round counter advances and round N+1 begins. Each subsequent member claims in their round. After all rounds complete, the circle status becomes `COMPLETED`.

### 7. Generate Participation Proof

On circle completion, click **Generate Proof**. This creates a portable ZK receipt that proves "I participated in a completed savings circle" without revealing which circle or your identity.

## Proof Generation Times

Proofs are generated client-side using the remote Midnight proof server. Times depend on circuit complexity and network latency.

| Circuit | Expected time |
|---------|--------------|
| `joinCircle` | 15–30s |
| `contribute` | 30–60s |
| `claimPayout` | 20–40s |
| `reportDefault` | 20–40s |
| `generateParticipationProof` | 15–25s |

## Running Tests Locally

If you have the repository cloned:

```bash
npm test
```

Unit tests run without Docker or network access. Integration tests require the Midnight Docker stack:

```bash
SKIP_INTEGRATION=false npm test
```
