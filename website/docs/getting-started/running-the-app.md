---
sidebar_position: 4
title: Running the App
---

# Running the App

With the Docker stack running and your wallet funded, you can deploy a savings circle and run through the full lifecycle.

## End-to-End Walkthrough

### 1. Connect Lace

Open `http://localhost:3000` in Chrome. Click **Connect Lace** in the top-right. Approve the connection in the Lace popup.

The navbar shows your NIGHT and DUST balances once connected.

### 2. Create a Circle

Navigate to **Circles → New Circle**.

| Field | Description | Example |
|-------|-------------|---------|
| Contribution amount | Fixed NIGHT per member per round | `1 NIGHT` |
| Member cap | Maximum members (4, 8, or 16) | `4` |
| Round duration | Time window per round | `10 minutes` |

Click **Deploy Circle**. This calls the `/api/deploy` route server-side, which:
1. Loads the compiled ZK artifacts from `build/`
2. Calls `deployContract()` via the Midnight SDK
3. Returns a contract address

**Expect:** ~10–30 seconds for deployment.

### 3. Join a Circle

Share the contract address with participants. Each member:
1. Goes to **Circles → [paste address]**
2. Clicks **Join Circle**

Joining:
- Generates a fresh member secret + nonce locally
- Computes `commitment = persistentCommit(secret, nonce)`
- Submits a ZK proof that commits the hash into the Merkle tree
- Saves the secret to LevelDB (private state)

**Expect:** ~15–30s proof generation time.

When the last slot fills, the circle auto-transitions from `OPEN` → `ROUND_IN_PROGRESS`.

:::warning Back up your secret
After joining, the app prompts you to export your member secret. If you lose local state, you lose access to your position in the circle.
:::

### 4. Contribute

During each `ROUND_IN_PROGRESS` phase, all members must contribute before the deadline.

Click **Contribute**. This:
1. Loads your member secret from local storage
2. Computes a round-specific nullifier: `persistentHash(secret || roundNumber)`
3. Verifies membership via Merkle path
4. Sends `contributionAmount` NIGHT to the contract pool

**Expect:** ~30–60s proof generation (most complex circuit).

### 5. Claim Payout

When all members contribute, status transitions to `PAYOUT_PENDING`. The member whose leaf index matches the current round number sees a **Claim Payout** button.

Claiming proves your Merkle position and receives `contributionAmount × memberCount` NIGHT.

### 6. Repeat

The round counter advances and round N+1 begins. Each subsequent member claims in their round. After all rounds complete, the circle status becomes `COMPLETED`.

### 7. Generate Participation Proof

On circle completion, click **Generate Proof**. This creates a portable ZK receipt that proves "I participated in a completed savings circle" without revealing which circle or your identity.

## Proof Generation Times

| Circuit | Expected time |
|---------|--------------|
| `joinCircle` | 15–30s |
| `contribute` | 30–60s |
| `claimPayout` | 20–40s |
| `reportDefault` | 20–40s |
| `generateParticipationProof` | 15–25s |

Times vary based on CPU. The proof server runs as a Docker container on your machine.

## Running Tests

```bash
npm test
```

Unit tests run without Docker. Integration tests require the stack:

```bash
SKIP_INTEGRATION=false npm test
```

Test coverage: 108 tests across unit (witnesses, providers, circuits) and integration (full lifecycle) suites.
