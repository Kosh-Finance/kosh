---
sidebar_position: 3
title: Interact
---

# Contract Interaction

`src/dapp/interact.ts` provides high-level async functions for each contract circuit. Each function:

1. Loads private state from LevelDB
2. Creates witnesses
3. Calls the circuit (triggers proof generation via proof server)
4. Submits the transaction
5. Returns the result with proof timing

## `getLedgerState`

Read the current public ledger state. No proof needed — reads directly from the Indexer GraphQL.

```typescript
const state: CircleLedgerState = await getLedgerState(
  providers,
  contractAddress,
  contractModule,
);

// Returns:
// {
//   contributionAmount: bigint,
//   memberCap: number,
//   roundCount: number,
//   roundDuration: bigint,
//   currentRound: number,
//   circleStatus: CircleStatus,
//   memberCount: number,
//   contributionsThisRound: number,
//   roundDeadline: bigint,
//   payoutClaimed: boolean,
//   merkleRoot: Uint8Array,
// }
```

## `subscribeLedgerState`

Subscribe to real-time ledger state changes. Returns an unsubscribe function.

```typescript
const unsubscribe = subscribeLedgerState(
  providers,
  contractAddress,
  contractModule,
  (state) => {
    console.log('Round:', state.currentRound, 'Status:', state.circleStatus);
  },
);

// Later:
unsubscribe();
```

Internally polls every 3 seconds via the Indexer. A native WebSocket subscription interface is on the roadmap once the SDK exposes typed subscriptions post-compile.

## `joinCircle`

```typescript
const result = await joinCircle(providers, contractAddress, contractModule);
// Returns: { txHash, blockNumber, proofGenerationMs, leafIndex, commitment }
```

Generates fresh member secrets, saves pre-join state, submits the join proof. After confirmation, reads back the member count to determine the assigned leaf index and saves the complete private state.

## `contribute`

```typescript
const result = await contribute(providers, contractAddress, contractModule);
// Returns: { txHash, blockNumber, proofGenerationMs }
```

Verifies the member is in the circle and the circle is in `ROUND_IN_PROGRESS`. Generates the contribution proof (membership + nullifier + Zswap transfer).

## `claimPayout`

```typescript
const result = await claimPayout(providers, contractAddress, contractModule);
// Returns: { txHash, blockNumber, proofGenerationMs, amountReceived }
```

Validates that it's the member's payout round (`leafIndex == currentRound`). Claims `contributionAmount × memberCap` NIGHT from the pool.

## `reportDefault`

```typescript
const result = await reportDefault(
  providers,
  contractAddress,
  contractModule,
  defaulterLeafIndex,  // leaf position of the defaulter
);
// Returns: { txHash, blockNumber, proofGenerationMs, revealedCommitment }
```

Fetches the defaulter's commitment from the Merkle tree at `defaulterLeafIndex`, proves it's absent from `spentIdentifiers`, and publishes the commitment.

## `generateParticipationProof`

```typescript
const result = await generateParticipationProof(providers, contractAddress, contractModule);
// Returns: { txHash, blockNumber, proofGenerationMs, receipt }
```

Available only when `circleStatus == COMPLETED`. Generates a portable ZK receipt.

## Error Handling

All functions throw descriptive errors for common cases:

```typescript
// Already joined:
throw new Error(`Already joined circle ${contractAddress} at leaf ${state.leafIndex}`);

// Not a member:
throw new Error('Not a member of this circle — join first.');

// Wrong payout round:
throw new Error(`Not your payout round. Your round: ${state.leafIndex}, current: ${ledger.currentRound}`);

// Payout not available:
throw new Error(`Payout not available — circle status is ${ledger.circleStatus}`);
```

## Proof Generation Timing

All result objects include `proofGenerationMs` for performance monitoring:

```typescript
console.log(`Proof generated in ${(result.proofGenerationMs / 1000).toFixed(1)}s`);
```

Target times:
- `joinCircle`: < 30s
- `contribute`: < 60s
- `claimPayout`: < 40s
- `reportDefault`: < 40s
- `generateParticipationProof`: < 25s
