---
sidebar_position: 1
title: Prerequisites
---

# Prerequisites

Before running Kosh locally, you need the following installed.

## Required Software

### Docker

The Midnight local dev network runs in Docker. Install Docker Desktop or Docker Engine:

- **Linux:** `curl -fsSL https://get.docker.com | sh`
- **macOS/Windows:** [Docker Desktop](https://www.docker.com/products/docker-desktop/)

Verify: `docker --version` (need 24+)

### Node.js

- **Version:** 18 or higher
- **Install:** [nodejs.org](https://nodejs.org/) or via `nvm`

```bash
node --version  # should be v18+
npm --version
```

### Compact Compiler

The Compact compiler (`compact`) compiles `.compact` contracts to ZK circuit keys.

```bash
curl --proto '=https' --tlsv1.2 -LsSf \
  https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
source ~/.bashrc  # or ~/.zshrc
compact --version  # should show 0.5.0+
```

To install a specific compiler version:

```bash
compact update 0.29.0
```

### Chrome + Lace Wallet

The frontend requires the [Lace wallet](https://www.lace.io/) Chrome extension to connect to the Midnight network.

1. Install Lace from the Chrome Web Store
2. Open Lace → Settings → Network → Select **"Undeployed"**

:::info
"Undeployed" is Midnight's network ID for local development. Lace will automatically connect to `localhost:9944/8088/6300` when set to this network.
:::

## Recommended

- **VS Code** with the [Compact extension](https://marketplace.visualstudio.com/items?itemName=midnight-ntwrk.compact) for syntax highlighting and type checking
- **Git** for cloning the repository

## Compatibility

| Platform | Support |
|----------|---------|
| Linux (x86_64) | Full support |
| macOS (Apple Silicon / Intel) | Full support |
| Windows | WSL2 only |

The Compact compiler ships native binaries for `x86_linux`, `aarch64_macos`, and `x86_macos`.
