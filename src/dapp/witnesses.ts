/**
 * Kosh — Witness Implementations
 *
 * Witnesses are declared in Compact but implemented here in TypeScript.
 * They supply private data to the ZK circuit — this data NEVER leaves the user's machine.
 *
 * The Compact runtime calls each witness with a WitnessContext (ledger + private state)
 * and expects [newPrivateState, value] back. Private state is managed by PrivateStateProvider.
 */

import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';
import type { Ledger, Witnesses } from '../../public/build/contract';

// ─── Private State Schema ─────────────────────────────────────────────────────

export interface MemberPrivateState {
  /** Member's 32-byte random secret. Used in identity commitment and round nullifiers. */
  memberSecret: Uint8Array;
  /** Randomness for identity commitment — makes commitment binding and unlinkable. */
  memberNonce: Uint8Array;
  /** Leaf index in the Merkle tree (= join order = payout round). */
  leafIndex: number;
  /** Contract address of the circle this state belongs to. */
  circleId: string;
  /** Block number when the member joined. */
  joinedAt: number;

  // ── Per-call transient data ─────────────────────────────────────────────
  // Set by prepareContribution() / preparePayout() before calling circuits.
  // Cleared from returned state after use to prevent stale data.

  /** true = recipient is a ZswapCoinPublicKey (wallet), false = ContractAddress. */
  recipientIsWallet?: boolean;
  /** Shielded coin to contribute — value stored as string for JSON compatibility. */
  pendingInCoin?: { nonce: Uint8Array; color: Uint8Array; value: string };
  /** Pool coin contract sends for payout — bigints stored as strings. */
  pendingOutCoin?: { nonce: Uint8Array; color: Uint8Array; value: string; mt_index: string };
  /** Recipient's shielded key bytes (ZswapCoinPublicKey or ContractAddress). */
  pendingRecipientKey?: Uint8Array;
}

// ─── Private State ID ─────────────────────────────────────────────────────────

/**
 * The key under which member private state is stored in the PrivateStateProvider.
 * Must match the `privateStateId` passed to deployContract / findDeployedContract.
 * The SDK scopes storage as `contractAddress:PRIVATE_STATE_ID` internally.
 */
export const PRIVATE_STATE_ID = 'kosh-member';

// ─── State Helpers ────────────────────────────────────────────────────────────

/** Generate fresh member secret and nonce for a new circle join. */
export function generateMemberSecrets(): { memberSecret: Uint8Array; memberNonce: Uint8Array } {
  const memberSecret = new Uint8Array(32);
  const memberNonce = new Uint8Array(32);
  crypto.getRandomValues(memberSecret);
  crypto.getRandomValues(memberNonce);
  return { memberSecret, memberNonce };
}

/**
 * Save member private state to the provider.
 * Calls setContractAddress first so the SDK's scoped storage (contractAddress:PRIVATE_STATE_ID)
 * matches what findDeployedContract / callTx circuits expect.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function saveMemberState(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  provider: any,
  circleId: string,
  state: MemberPrivateState,
): Promise<void> {
  provider.setContractAddress?.(circleId);
  await provider.set(PRIVATE_STATE_ID, state);
}

/**
 * Load member private state.
 * Calls setContractAddress first to match the SDK's scoped key lookup.
 */
export async function loadMemberState(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  provider: any,
  circleId: string,
): Promise<MemberPrivateState | null> {
  provider.setContractAddress?.(circleId);
  return provider.get(PRIVATE_STATE_ID);
}

// ─── Pre-call State Mutators ──────────────────────────────────────────────────

/**
 * Return a copy of `state` with the contribution coin set.
 * Call before invoking the `contribute()` circuit.
 */
export function prepareContribution(
  state: MemberPrivateState,
  coin: { nonce: Uint8Array; color: Uint8Array; value: bigint },
): MemberPrivateState {
  return {
    ...state,
    pendingInCoin: {
      nonce: coin.nonce,
      color: coin.color,
      value: coin.value.toString(),
    },
  };
}

/**
 * Return a copy of `state` with the payout coin and recipient set.
 * Call before invoking the `claimPayout()` circuit.
 *
 * @param isWallet - true (default) = recipient is a ZswapCoinPublicKey (wallet shielded address)
 *                   false = recipient is a ContractAddress
 */
export function preparePayout(
  state: MemberPrivateState,
  coin: { nonce: Uint8Array; color: Uint8Array; value: bigint; mt_index: bigint },
  recipientKey: Uint8Array,
  isWallet = true,
): MemberPrivateState {
  return {
    ...state,
    pendingOutCoin: {
      nonce: coin.nonce,
      color: coin.color,
      value: coin.value.toString(),
      mt_index: coin.mt_index.toString(),
    },
    pendingRecipientKey: recipientKey,
    recipientIsWallet: isWallet,
  };
}

// ─── Witness Factory ──────────────────────────────────────────────────────────

/**
 * Build the Witnesses<MemberPrivateState> object expected by the compiled contract.
 *
 * Each witness receives a WitnessContext (ledger state + private state) and returns
 * [updatedPrivateState, witnessValue]. The private state is immutable in witnesses;
 * updated copies are returned when transient data is consumed.
 */
export function createWitnesses(): Witnesses<MemberPrivateState> {
  return {
    memberSecret(context: WitnessContext<Ledger, MemberPrivateState>) {
      return [context.privateState, context.privateState.memberSecret];
    },

    memberNonce(context: WitnessContext<Ledger, MemberPrivateState>) {
      return [context.privateState, context.privateState.memberNonce];
    },

    memberMerklePath(context: WitnessContext<Ledger, MemberPrivateState>) {
      const { ledger, privateState } = context;
      const { leafIndex, memberNonce } = privateState;

      // memberNonce is used as the leaf value here. In the ZK circuit, the leaf is
      // persistentCommit(secret, nonce) — a poseidon2 hash over BLS12-377.
      // The runtime provides the native hash function; memberNonce serves as the leaf
      // identity in this TypeScript layer (consistent with how pathForLeaf is called).
      let path: typeof ledger.memberTree extends { pathForLeaf(...a: any[]): infer R } ? R : never;
      path = ledger.memberTree.pathForLeaf(BigInt(leafIndex), memberNonce);
      if (!path) {
        path = ledger.memberTree.findPathForLeaf(memberNonce)!;
      }
      if (!path) {
        throw new Error(
          `Merkle path not found for leaf index ${leafIndex}. ` +
          'Wait for the join transaction to confirm, then retry.',
        );
      }

      return [privateState, path];
    },

    inCoin(context: WitnessContext<Ledger, MemberPrivateState>) {
      const { privateState } = context;
      if (!privateState.pendingInCoin) {
        throw new Error(
          'No pending contribution coin. ' +
          'Call prepareContribution() before invoking contribute().',
        );
      }
      const { nonce, color, value } = privateState.pendingInCoin;
      // Return updated state with pendingInCoin cleared (consumed)
      const newState: MemberPrivateState = { ...privateState, pendingInCoin: undefined };
      return [newState, { nonce, color, value: BigInt(value) }];
    },

    outCoin(context: WitnessContext<Ledger, MemberPrivateState>) {
      const { privateState } = context;
      if (!privateState.pendingOutCoin) {
        throw new Error(
          'No pending payout coin. ' +
          'Call preparePayout() before invoking claimPayout().',
        );
      }
      const { nonce, color, value, mt_index } = privateState.pendingOutCoin;
      const newState: MemberPrivateState = { ...privateState, pendingOutCoin: undefined };
      return [newState, { nonce, color, value: BigInt(value), mt_index: BigInt(mt_index) }];
    },

    payoutRecipient(context: WitnessContext<Ledger, MemberPrivateState>) {
      const { privateState } = context;
      if (!privateState.pendingRecipientKey) {
        throw new Error('No payout recipient set. Call preparePayout() before invoking claimPayout().');
      }
      const key = privateState.pendingRecipientKey;
      const isWallet = privateState.recipientIsWallet !== false; // default true
      const empty = new Uint8Array(32);
      return [
        privateState,
        {
          is_left: isWallet,
          left: { bytes: isWallet ? key : empty },
          right: { bytes: isWallet ? empty : key },
        },
      ];
    },
  };
}

export type KoshWitnesses = Witnesses<MemberPrivateState>;
