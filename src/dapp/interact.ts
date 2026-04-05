/**
 * Kosh — Contract Interaction Helpers
 *
 * High-level async functions wrapping each Compact circuit call.
 * Each function:
 *   1. Loads private state from LevelDB
 *   2. Creates witnesses
 *   3. Calls the contract circuit (triggers proof generation)
 *   4. Submits the transaction
 *   5. Updates local private state as needed
 */

// The midnight-js-contracts SDK uses findDeployedContract + callTx interface.
// We use dynamic any-typed imports to avoid compile-time binding to the
// compiled contract generics (which aren't known until compact compile runs).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { findDeployedContract as _findType } from '@midnight-ntwrk/midnight-js-contracts';
import type { KoshProviders } from './providers';
import {
  createWitnesses,
  generateMemberSecrets,
  loadMemberState,
  saveMemberState,
  prepareContribution,
  preparePayout,
  PRIVATE_STATE_ID,
} from './witnesses';

// ─── Types ────────────────────────────────────────────────────────────────────

// Mirrors the Compact CircleStatus enum (numeric: 0=OPEN, 1=ROUND_IN_PROGRESS, 2=PAYOUT_PENDING, 3=DEFAULT_DETECTED, 4=COMPLETED)
export enum CircleStatus {
  OPEN = 'OPEN',
  ROUND_IN_PROGRESS = 'ROUND_IN_PROGRESS',
  PAYOUT_PENDING = 'PAYOUT_PENDING',
  DEFAULT_DETECTED = 'DEFAULT_DETECTED',
  COMPLETED = 'COMPLETED',
}

const STATUS_MAP: Record<number, CircleStatus> = {
  0: CircleStatus.OPEN,
  1: CircleStatus.ROUND_IN_PROGRESS,
  2: CircleStatus.PAYOUT_PENDING,
  3: CircleStatus.DEFAULT_DETECTED,
  4: CircleStatus.COMPLETED,
};

// Public ledger state — mirrors rosca.compact ledger declarations
export interface CircleLedgerState {
  contributionAmount: bigint;
  memberCap: number;
  roundCount: number;
  roundDuration: bigint;
  currentRound: number;
  circleStatus: CircleStatus;
  memberCount: number;
  contributionsThisRound: number;
  roundDeadline: bigint;
  payoutClaimed: boolean;
  merkleRoot: Uint8Array;
  tokenColor: Uint8Array;
}

export interface TransactionResult {
  txHash: string;
  blockNumber: number;
  proofGenerationMs: number;
}

// ─── Read Ledger State ────────────────────────────────────────────────────────

/**
 * Read the current public ledger state of a circle.
 * No proof needed — reads directly from Indexer GraphQL.
 */
async function getContractHandle(
  providers: KoshProviders,
  contractModule: unknown,
  contractAddress: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  // Wrap raw module in a CompiledContract with witnesses attached.
  // The SDK accesses compiledContract[CompactContextInternal.TypeId].ctor;
  // passing the raw ES module causes "Cannot read properties of undefined (reading 'ctor')".
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { CompiledContract } = await import('@midnight-ntwrk/compact-js') as any;
  const compiledContract = CompiledContract.withWitnesses(
    CompiledContract.make('kosh-rosca', (contractModule as any).Contract),
    createWitnesses(),
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sdk: any = await import('@midnight-ntwrk/midnight-js-contracts');
  return sdk.findDeployedContract(providers, {
    compiledContract,
    contractAddress,
    privateStateId: PRIVATE_STATE_ID,
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapLedger(ledger: any): CircleLedgerState {
  return {
    contributionAmount: ledger.contributionAmount,
    memberCap: Number(ledger.memberCap),
    roundCount: Number(ledger.roundCount),
    roundDuration: ledger.roundDuration,
    currentRound: Number(ledger.currentRound),
    circleStatus: STATUS_MAP[Number(ledger.circleStatus)] ?? CircleStatus.OPEN,
    memberCount: Number(ledger.memberCount),
    contributionsThisRound: Number(ledger.contributionsThisRound),
    roundDeadline: ledger.roundDeadline,
    payoutClaimed: ledger.payoutClaimed,
    merkleRoot: ledger.memberTree.root,
    tokenColor: ledger.tokenColor,
  };
}

export async function getLedgerState(
  providers: KoshProviders,
  contractAddress: string,
  contractModule: unknown,
): Promise<CircleLedgerState> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { getPublicStates } = await import('@midnight-ntwrk/midnight-js-contracts') as any;
  const { contractState } = await getPublicStates(providers.publicDataProvider, contractAddress);
  // contractState.data is the ChargedState; contractModule.ledger() decodes to typed Ledger
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ledger = (contractModule as any).ledger(contractState.data);
  return mapLedger(ledger);
}

/**
 * Subscribe to real-time ledger state updates via WebSocket.
 * Returns an unsubscribe function.
 */
export function subscribeLedgerState(
  providers: KoshProviders,
  contractAddress: string,
  contractModule: unknown,
  onUpdate: (state: CircleLedgerState) => void,
): () => void {
  // Subscribe via the public data provider's WebSocket connection.
  // The indexer streams ledger state changes; we poll here as a fallback
  // until the SDK exposes a typed subscription interface post-compile.
  const ws = providers.publicDataProvider;
  let cancelled = false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (async () => {
    while (!cancelled) {
      try {
        const state = await getLedgerState(providers, contractAddress, contractModule);
        if (!cancelled) onUpdate(state);
      } catch {
        // Connection not yet ready — retry
      }
      await new Promise(r => setTimeout(r, 3000));
    }
  })();

  void ws; // suppress unused warning — ws used for type context
  return () => { cancelled = true; };
}

// ─── joinCircle ───────────────────────────────────────────────────────────────

/**
 * Join a circle by committing a new identity into the Merkle tree.
 *
 * Generates fresh member secrets (secret + nonce), computes the commitment
 * in-circuit, inserts it into the Merkle tree, and saves private state locally.
 *
 * After this call, the member's commitment is on-chain (just the hash),
 * and their secret + nonce + path are stored in LevelDB.
 */
export async function joinCircle(
  providers: KoshProviders,
  contractAddress: string,
  contractModule: unknown,
): Promise<TransactionResult & { leafIndex: number; commitment: Uint8Array }> {
  // Check if already joined
  const existingState = await loadMemberState(
    providers.privateStateProvider,
    contractAddress,
  );
  if (existingState && existingState.leafIndex >= 0) {
    throw new Error(`Already joined circle ${contractAddress} at leaf ${existingState.leafIndex}`);
  }

  // Generate fresh secrets for this circle
  const { memberSecret, memberNonce } = generateMemberSecrets();

  // Save pre-join state so witnesses can return secrets during proof generation
  const preJoinState = {
    memberSecret,
    memberNonce,
    leafIndex: -1,    // Will be updated after tx confirms
    circleId: contractAddress,
    joinedAt: 0,
    recipientIsWallet: true,
  };
  await saveMemberState(providers.privateStateProvider, contractAddress, preJoinState);

  const found = await getContractHandle(providers, contractModule, contractAddress);

  // deadline = now + roundDuration (seconds). The contract enforces joining before deadline.
  const ledgerForDeadline = await getLedgerState(providers, contractAddress, contractModule);
  const deadline = BigInt(Math.floor(Date.now() / 1000)) + ledgerForDeadline.roundDuration;

  const proofStart = Date.now();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = await found.callTx.joinCircle(deadline);
  const proofGenerationMs = Date.now() - proofStart;

  // After joining, read back the member count to determine leaf index
  const ledger = await getLedgerState(providers, contractAddress, contractModule);
  const leafIndex = ledger.memberCount - 1;  // Just joined → count - 1
  const blockHeight: number = result?.public?.blockHeight ?? 0;

  // Save complete private state (Merkle path computed on-demand from ledger in witness)
  await saveMemberState(providers.privateStateProvider, contractAddress, {
    ...preJoinState,
    leafIndex,
    joinedAt: blockHeight,
  });

  console.log(`✅ Joined circle at leaf position ${leafIndex} (payout round ${leafIndex})`);
  console.log(`   Proof generated in ${(proofGenerationMs / 1000).toFixed(1)}s`);

  return {
    txHash: result?.public?.txHash ?? '',
    blockNumber: blockHeight,
    proofGenerationMs,
    leafIndex,
    commitment: new Uint8Array(32),
  };
}

// ─── contribute ───────────────────────────────────────────────────────────────

/**
 * Contribute the fixed amount for the current round.
 *
 * The circuit verifies membership (Merkle proof) and computes an unlinkable
 * round nullifier before executing the Zswap token transfer.
 * No information about which member contributed is published on-chain.
 */
export async function contribute(
  providers: KoshProviders,
  contractAddress: string,
  contractModule: unknown,
): Promise<TransactionResult> {
  const state = await loadMemberState(providers.privateStateProvider, contractAddress);
  if (!state || state.leafIndex < 0) {
    throw new Error('Not a member of this circle — join first.');
  }

  // Merkle path is computed fresh from ledger state in the witness function
  const ledger = await getLedgerState(providers, contractAddress, contractModule);

  // Set up the contribution coin witnesses require before the circuit runs.
  // The nonce is fresh random bytes — Lace's balanceTx will replace this virtual
  // coin with a real on-chain UTXO when balancing the transaction.
  const preparedState = prepareContribution(state, {
    nonce: crypto.getRandomValues(new Uint8Array(32)),
    color: ledger.tokenColor,
    value: ledger.contributionAmount,
  });
  await saveMemberState(providers.privateStateProvider, contractAddress, preparedState);

  const found = await getContractHandle(providers, contractModule, contractAddress);

  console.log(`🔐 Generating contribution proof for round ${ledger.currentRound}...`);
  const proofStart = Date.now();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = await found.callTx.contribute();
  const proofGenerationMs = Date.now() - proofStart;

  console.log(`✅ Contributed to round ${ledger.currentRound}`);
  console.log(`   Proof generated in ${(proofGenerationMs / 1000).toFixed(1)}s`);
  console.log('   Your identity is not linked to this contribution on-chain.');

  return {
    txHash: result?.public?.txHash ?? '',
    blockNumber: result?.public?.blockHeight ?? 0,
    proofGenerationMs,
  };
}

// ─── claimPayout ──────────────────────────────────────────────────────────────

/**
 * Claim the full pool payout for the current round.
 * Only available when circleStatus == PAYOUT_PENDING AND
 * the caller's leaf index matches the current round number.
 *
 * @param walletApi - Connected Lace wallet API (for recipient shielded key)
 */
export async function claimPayout(
  providers: KoshProviders,
  contractAddress: string,
  contractModule: unknown,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  walletApi: any,
): Promise<TransactionResult & { amountReceived: bigint }> {
  const state = await loadMemberState(providers.privateStateProvider, contractAddress);
  if (!state || state.leafIndex < 0) {
    throw new Error('Not a member of this circle.');
  }

  const ledger = await getLedgerState(providers, contractAddress, contractModule);

  if (ledger.circleStatus !== CircleStatus.PAYOUT_PENDING) {
    throw new Error(`Payout not available — circle status is ${ledger.circleStatus}`);
  }

  if (state.leafIndex !== ledger.currentRound) {
    throw new Error(
      `Not your payout round. Your round: ${state.leafIndex}, current: ${ledger.currentRound}`,
    );
  }

  // Decode recipient shielded key from Lace wallet
  const { shieldedCoinPublicKey } = await walletApi.getShieldedAddresses();
  const { fromHex } = await import('@midnight-ntwrk/midnight-js-utils');
  const recipientKeyBytes = fromHex(
    shieldedCoinPublicKey.startsWith('0x') ? shieldedCoinPublicKey.slice(2) : shieldedCoinPublicKey,
  );

  const payoutAmount = ledger.contributionAmount * BigInt(ledger.memberCap);

  // Set up the payout coin witnesses require before the circuit runs.
  // The nonce is fresh random bytes; mt_index 0n is a placeholder that Lace replaces
  // when balancing (the contract emits the actual shielded output UTXO).
  const preparedState = preparePayout(
    state,
    {
      nonce: crypto.getRandomValues(new Uint8Array(32)),
      color: ledger.tokenColor,
      value: payoutAmount,
      mt_index: 0n,
    },
    recipientKeyBytes,
    true, // recipient is wallet (ZswapCoinPublicKey)
  );
  await saveMemberState(providers.privateStateProvider, contractAddress, preparedState);

  const found = await getContractHandle(providers, contractModule, contractAddress);
  const nextDeadline = BigInt(Math.floor(Date.now() / 1000)) + ledger.roundDuration;

  console.log(`💰 Claiming payout for round ${ledger.currentRound}...`);
  const proofStart = Date.now();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = await found.callTx.claimPayout(nextDeadline);
  const proofGenerationMs = Date.now() - proofStart;

  const amountReceived = ledger.contributionAmount * BigInt(ledger.memberCap);
  console.log(`✅ Payout claimed: ${Number(amountReceived) / 1_000_000} NIGHT`);
  console.log(`   Proof generated in ${(proofGenerationMs / 1000).toFixed(1)}s`);

  return {
    txHash: result?.public?.txHash ?? '',
    blockNumber: result?.public?.blockHeight ?? 0,
    proofGenerationMs,
    amountReceived,
  };
}

// ─── reportDefault ────────────────────────────────────────────────────────────

/**
 * Report a member who failed to contribute by the round deadline.
 * Reveals ONLY the defaulter's commitment hash — honest members stay private.
 *
 * @param defaulterLeafIndex - The Merkle tree position of the defaulter
 * @param defaulterSecret - The defaulter's secret (known to organizer off-chain)
 * @param defaulterNonce - The defaulter's nonce (for commitment verification)
 */
export async function reportDefault(
  providers: KoshProviders,
  contractAddress: string,
  contractModule: unknown,
  defaulterLeafIndex: number,
): Promise<TransactionResult & { revealedCommitment: Uint8Array }> {
  const found = await getContractHandle(providers, contractModule, contractAddress);

  // Fetch the defaulter's commitment from the Merkle tree at their leaf index
  const defaulterCommitment = await getLeafCommitment(
    providers,
    contractAddress,
    defaulterLeafIndex,
  );

  console.log(`⚠️  Reporting default for leaf ${defaulterLeafIndex}...`);
  console.log(`   Commitment: 0x${Buffer.from(defaulterCommitment).toString('hex').slice(0, 16)}...`);
  console.log('   Only the defaulter\'s commitment will be published.');

  const proofStart = Date.now();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = await found.callTx.reportDefault(defaulterCommitment);
  const proofGenerationMs = Date.now() - proofStart;

  console.log(`✅ Default reported. Only commitment hash is on-chain — honest members stay private.`);

  return {
    txHash: result?.public?.txHash ?? '',
    blockNumber: result?.public?.blockHeight ?? 0,
    proofGenerationMs,
    revealedCommitment: defaulterCommitment,
  };
}

// ─── generateParticipationProof ───────────────────────────────────────────────

/**
 * Generate a portable proof of circle completion.
 * Returns a receipt that can be shared externally to prove participation
 * without revealing identity or which circle was completed.
 */
export async function generateParticipationProof(
  providers: KoshProviders,
  contractAddress: string,
  contractModule: unknown,
): Promise<TransactionResult & { receipt: Uint8Array }> {
  const found = await getContractHandle(providers, contractModule, contractAddress);

  console.log('📜 Generating participation proof...');
  const proofStart = Date.now();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = await found.callTx.generateParticipationProof();
  const proofGenerationMs = Date.now() - proofStart;

  // The circuit returns a Bytes<32> receipt via the circuit return value,
  // accessible as the private result field of the call transaction data.
  const receipt: Uint8Array = result?.private?.result ?? new Uint8Array(32);

  console.log(`✅ Participation proof generated`);
  console.log(`   Receipt: 0x${Buffer.from(receipt).toString('hex').slice(0, 32)}...`);
  console.log('   Share this receipt to prove participation without revealing your identity.');

  return {
    txHash: result?.public?.txHash ?? '',
    blockNumber: result?.public?.blockHeight ?? 0,
    proofGenerationMs,
    receipt,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Retrieve the Merkle authentication path for a leaf at a given index.
 * The Indexer tracks the Merkle tree state — we query it to get sibling hashes.
 */
async function getMerklePath(
  providers: KoshProviders,
  contractAddress: string,
  leafIndex: number,
): Promise<Uint8Array[]> {
  // Query the Indexer GraphQL for the Merkle path at this leaf index
  // The Indexer maintains the full tree state from observed insertion transactions
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_INDEXER_URL ?? 'http://localhost:8088/api/v3/graphql'}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query GetMerklePath($address: String!, $leafIndex: Int!) {
            contract(address: $address) {
              ledger {
                memberTree {
                  path(leafIndex: $leafIndex) {
                    siblings
                  }
                }
              }
            }
          }
        `,
        variables: { address: contractAddress, leafIndex },
      }),
    },
  );

  const data = await response.json();
  const siblings: string[] = data?.data?.contract?.ledger?.memberTree?.path?.siblings ?? [];
  return siblings.map(s => Buffer.from(s, 'hex'));
}

/**
 * Retrieve the commitment stored at a specific leaf index in the Merkle tree.
 */
async function getLeafCommitment(
  providers: KoshProviders,
  contractAddress: string,
  leafIndex: number,
): Promise<Uint8Array> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_INDEXER_URL ?? 'http://localhost:8088/api/v3/graphql'}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query GetLeaf($address: String!, $leafIndex: Int!) {
            contract(address: $address) {
              ledger {
                memberTree {
                  leaf(index: $leafIndex)
                }
              }
            }
          }
        `,
        variables: { address: contractAddress, leafIndex },
      }),
    },
  );

  const data = await response.json();
  const leaf: string = data?.data?.contract?.ledger?.memberTree?.leaf ?? '';
  if (!leaf) throw new Error(`No leaf found at index ${leafIndex}`);
  return Buffer.from(leaf, 'hex');
}
