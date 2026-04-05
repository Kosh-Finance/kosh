---
sidebar_position: 1
title: Prerequisites
---

# Prerequisites

## Using the App

To deploy and participate in circles on [app.kosh.finance](https://app.kosh.finance), you only need:

### Chrome + Lace Midnight Extension

Kosh runs entirely in the browser via the [Lace Midnight](https://www.lace.io/) wallet extension.

1. Install **Lace** from the Chrome Web Store
2. Open Lace → switch to the **Midnight** tab
3. Set network to **Preprod**
4. Fund your wallet with test NIGHT and DUST from the [Midnight faucet](https://faucet.midnight.network)

:::info Preprod network
Kosh is deployed on Midnight's public **preprod** testnet. Lace must be on the "Preprod" network — not "Preview" or "Undeployed" (which is for local Docker dev only).
:::

:::tip Brave browser
If using Brave, disable shields for `app.kosh.finance` — Brave's aggressive content blocking can prevent extension injection.
:::

No Docker, no Node.js, and no local setup are needed to use the live app.

---

## Local Contract Development

To modify the Compact contract or run tests locally, you additionally need:

### Docker

The Midnight local dev network runs in Docker containers.

- **Linux:** `curl -fsSL https://get.docker.com | sh`
- **macOS/Windows:** [Docker Desktop](https://www.docker.com/products/docker-desktop/)

Verify: `docker --version` (need 24+)

### Node.js 20+

```bash
node --version  # should be v20+
npm --version
```

### Compact Compiler

Compiles `.compact` contracts to ZK circuit keys.

```bash
curl --proto '=https' --tlsv1.2 -LsSf \
  https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
source ~/.bashrc   # or ~/.zshrc
compact --version
```

### Lace on "Undeployed" network

For local dev, set Lace to the **"Undeployed"** network so it targets `localhost`.

## Compatibility

| Platform | Support |
|----------|---------|
| Chrome / Chromium | Full support |
| Brave (shields off) | Full support |
| Firefox | Not supported (Lace Midnight is Chrome-only) |
| Linux / macOS / Windows (WSL2) | Local dev supported |
