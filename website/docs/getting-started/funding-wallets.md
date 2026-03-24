---
sidebar_position: 3
title: Funding Test Wallets
---

# Funding Test Wallets

To deploy contracts and submit transactions on the local network, wallets need NIGHT tokens and DUST (gas). This guide covers two approaches.

## NIGHT vs DUST

| Token | Purpose | How to get |
|-------|---------|-----------|
| **NIGHT** | Transaction value (savings contributions, payouts) | Genesis funding CLI |
| **DUST** | Gas fees (non-transferable) | Auto-derived from NIGHT holdings (5 DUST per NIGHT) |

DUST is automatically generated from your NIGHT balance and is non-transferable. The funding CLI registers DUST as part of the funding process.

## Using the Funding Tool

Kosh includes the bricktowers funding tool at `scripts/midnight-local-network/`.

### Setup

```bash
cd scripts/midnight-local-network
npm install
```

### Get Your Shielded Address

1. Open Chrome with the Lace extension
2. Set Lace network to **"Undeployed"**
3. Go to **Receive** → copy your **shielded address**

The address looks like: `mn_shield-addr_undeployed_...`

### Fund the Wallet

```bash
cd scripts/midnight-local-network
yarn fund "mn_shield-addr_undeployed_YOUR_ADDRESS_HERE"
```

This sends **50,000 NIGHT** from the genesis wallet and registers DUST for gas.

:::info Genesis wallet
The local Midnight node starts with a pre-funded genesis wallet (seed `0x0000...0001`). The funding tool uses this to send tokens to any address.
:::

## Test Accounts

For automated testing, `accounts.json` in the project root contains 4 pre-defined test wallet mnemonics:

```json
[
  { "name": "alice", "mnemonic": "..." },
  { "name": "bob",   "mnemonic": "..." },
  { "name": "carol", "mnemonic": "..." },
  { "name": "dave",  "mnemonic": "..." }
]
```

Fund all four at once:

```bash
cd scripts/midnight-local-network
for addr in $(cat ../../accounts.json | jq -r '.[].address'); do
  yarn fund "$addr"
done
```

## Checking Balances

Once Lace is connected and the wallet is funded, the Kosh frontend displays balances in the top-right corner:

- **NIGHT** — your shielded token balance
- **DUST** — your gas balance

A minimum DUST balance is required before any transaction. The app shows a warning if DUST is low.

## Troubleshooting

**"Connection refused" when funding:**
Make sure the Docker stack is running: `docker compose ps`

**Balance not updating in Lace:**
The indexer takes a few seconds to process the transaction. Wait ~10 seconds and refresh Lace.

**DUST balance shows 0:**
DUST registration happens on the first NIGHT transaction. If the balance is 0 after funding, try sending yourself 1 NIGHT via Lace to trigger registration.
