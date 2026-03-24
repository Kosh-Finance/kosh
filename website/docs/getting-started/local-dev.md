---
sidebar_position: 2
title: Local Dev Setup
---

# Local Dev Setup

This guide gets the full Kosh stack running locally: Midnight node, indexer, proof server, compiled contract, and the Next.js frontend.

## 1. Clone the Repository

```bash
git clone https://github.com/kosh-finance/kosh.git
cd kosh
npm install
```

## 2. Start the Midnight Stack

Kosh ships a `docker-compose.yml` that starts all three required services:

```bash
docker compose up -d
```

This starts:

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `kosh-node` | `midnightntwrk/midnight-node:0.22.1` | 9944 | Midnight blockchain node |
| `kosh-indexer` | `midnightntwrk/indexer-standalone:4.0.0` | 8088 | GraphQL API for ledger state |
| `kosh-proof-server` | `midnightntwrk/proof-server:8.0.3` | 6300 | ZK proof generation |

Wait for all containers to be healthy (~30 seconds):

```bash
docker compose ps
# NAME              STATUS
# kosh-node         Up (healthy)
# kosh-indexer      Up (healthy)
# kosh-proof-server Up
```

Verify the node is reachable:

```bash
curl http://localhost:9944/health
# {"status":"ok"}
```

## 3. Compile the Compact Contract

This generates the ZK circuit keys needed for real proofs. It takes 5–15 minutes on first run.

```bash
compact compile +0.29.0 src/contracts/rosca.compact build/
```

Output structure after compilation:

```
build/
├── contract/          # TypeScript bindings
│   ├── index.js
│   └── index.d.ts
├── keys/              # Proving and verifying keys
│   ├── joinCircle.prover
│   ├── joinCircle.verifier
│   ├── contribute.prover
│   ├── contribute.verifier
│   └── ...            # One pair per circuit
└── zkir/              # ZK Intermediate Representation
    ├── joinCircle.zkir
    └── ...
```

:::tip Skip ZK for development
Add `--skip-zk` to compile without generating circuit keys (much faster, but proofs won't work):

```bash
compact compile +0.29.0 --skip-zk src/contracts/rosca.compact build/
```
:::

## 4. Start the Frontend

```bash
npm run dev
```

The app runs at `http://localhost:3000` (or 3001 if 3000 is in use).

## Environment Variables

The `.env.local` file is pre-configured for the Docker stack:

```env
NEXT_PUBLIC_INDEXER_URL=http://localhost:8088/api/v1/graphql
NEXT_PUBLIC_INDEXER_WS_URL=ws://localhost:8088/api/v1/graphql/ws
NEXT_PUBLIC_NODE_URL=http://localhost:9944
NEXT_PUBLIC_PROOF_SERVER_URL=http://localhost:6300
NEXT_PUBLIC_NETWORK_ID=undeployed
PRIVATE_STATE_PATH=~/.kosh/state
```

## Stopping the Stack

```bash
docker compose down        # stop containers
docker compose down -v     # stop + remove volumes (fresh start)
```

## Troubleshooting

**Port already in use:**
```bash
lsof -i :9944   # find what's using the port
# or change the port mapping in docker-compose.yml
```

**Containers restart-looping:**
```bash
docker compose logs -f node       # tail node logs
docker compose logs -f indexer    # tail indexer logs
```

**`compact` not found:**
```bash
source ~/.bashrc    # reload PATH
which compact       # should show ~/.local/bin/compact
```
