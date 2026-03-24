---
sidebar_position: 3
title: Witness Functions
---

# Witness Functions

Witnesses are the **privacy boundary** in Kosh. They are declared in Compact but implemented in TypeScript. They supply private data to ZK circuits — data that is used to compute proofs but never published on-chain.

## Declaration (in rosca.compact)

```compact
// Private member identity
witness memberSecret(): Bytes<32>;
witness memberNonce(): Bytes<32>;

// Merkle authentication path (proves which leaf the member occupies)
witness memberMerklePath(): MerkleTreePath<4>;

// Zswap coin witnesses for token operations
witness inCoin(): ZswapCoinInput;
witness outCoin(): ZswapCoinOutput;
witness payoutRecipient(): ZswapCoinOutput;
```

## Implementation (in src/dapp/witnesses.ts)

```typescript
export function createWitnesses(): Witnesses {
  return {
    // Returns member's 32-byte secret from LevelDB
    memberSecret: () => loadFromPrivateState('memberSecret'),

    // Returns member's 32-byte nonce from LevelDB
    memberNonce: () => loadFromPrivateState('memberNonce'),

    // Computes Merkle authentication path from current ledger state
    memberMerklePath: () => computeMerklePath(leafIndex, merkleRoot),

    // Zswap coin inputs/outputs (handled by wallet SDK)
    inCoin: () => wallet.createZswapInput(contributionAmount),
    outCoin: () => wallet.createZswapOutput(),
    payoutRecipient: () => wallet.createZswapOutput(),
  };
}
```

## Private State Schema

Member private state is persisted in LevelDB via `privateStateProvider`:

```typescript
interface MemberPrivateState {
  memberSecret: Uint8Array;   // 32-byte random secret (generated on join)
  memberNonce: Uint8Array;    // 32-byte random nonce (generated on join)
  leafIndex: number;          // Position in Merkle tree (= payout round)
  circleId: string;           // Contract address
  joinedAt: number;           // Block number when joined
  recipientIsWallet: boolean; // Whether payout recipient = wallet address
}
```

The LevelDB store is keyed by contract address. Each circle a member joins creates a separate entry.

:::warning Protect your private state
If a member loses their private state (`~/.kosh/state`), they lose the ability to:
- Contribute to future rounds
- Claim their payout
- Generate a participation proof

**Back up your secrets after joining.** The app provides an export option.
:::

## Secret Generation

Secrets are generated using the browser's Web Crypto API (CSPRNG):

```typescript
export function generateMemberSecrets(): { memberSecret: Uint8Array; memberNonce: Uint8Array } {
  const memberSecret = new Uint8Array(32);
  const memberNonce  = new Uint8Array(32);
  crypto.getRandomValues(memberSecret);
  crypto.getRandomValues(memberNonce);
  return { memberSecret, memberNonce };
}
```

Two separate 32-byte values are generated:
- `memberSecret` — the long-term identity secret (reused across rounds for the same circle)
- `memberNonce` — randomizes the identity commitment (so the same secret joined twice produces different commitments)

## Merkle Path Computation

The `memberMerklePath()` witness provides the authentication path from the member's leaf to the Merkle root. The path is not stored locally — it's computed fresh from the current on-chain state on each call:

```typescript
async function computeMerklePath(
  leafIndex: number,
  contractAddress: string,
): Promise<MerkleTreePath> {
  // Query the Indexer GraphQL for sibling hashes
  const response = await fetch(INDEXER_URL, {
    method: 'POST',
    body: JSON.stringify({
      query: `query { contract(address: $address) {
        ledger { memberTree { path(leafIndex: $leafIndex) { siblings } } }
      } }`,
      variables: { address: contractAddress, leafIndex },
    }),
  });
  const siblings = await response.json();
  return buildPath(siblings);
}
```

The Indexer maintains the full Merkle tree state from observed insertion transactions. Fresh path computation ensures correctness even if the tree root has changed since joining.
