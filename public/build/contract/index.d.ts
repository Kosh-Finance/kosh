import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<PS> = {
  memberSecret(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  memberNonce(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  memberMerklePath(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, { leaf: Uint8Array,
                                                                                 path: { sibling: { field: bigint
                                                                                                  },
                                                                                         goes_left: boolean
                                                                                       }[]
                                                                               }];
  inCoin(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, { nonce: Uint8Array,
                                                                       color: Uint8Array,
                                                                       value: bigint
                                                                     }];
  outCoin(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, { nonce: Uint8Array,
                                                                        color: Uint8Array,
                                                                        value: bigint,
                                                                        mt_index: bigint
                                                                      }];
  payoutRecipient(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, { is_left: boolean,
                                                                                left: { bytes: Uint8Array
                                                                                      },
                                                                                right: { bytes: Uint8Array
                                                                                       }
                                                                              }];
}

export type ImpureCircuits<PS> = {
  createCircle(context: __compactRuntime.CircuitContext<PS>,
               amount_0: bigint,
               cap_0: bigint,
               rounds_0: bigint,
               duration_0: bigint,
               color_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  joinCircle(context: __compactRuntime.CircuitContext<PS>, deadline_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  contribute(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  claimPayout(context: __compactRuntime.CircuitContext<PS>,
              nextDeadline_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  reportDefault(context: __compactRuntime.CircuitContext<PS>,
                leafCommitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  generateParticipationProof(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, Uint8Array>;
}

export type ProvableCircuits<PS> = {
  createCircle(context: __compactRuntime.CircuitContext<PS>,
               amount_0: bigint,
               cap_0: bigint,
               rounds_0: bigint,
               duration_0: bigint,
               color_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  joinCircle(context: __compactRuntime.CircuitContext<PS>, deadline_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  contribute(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  claimPayout(context: __compactRuntime.CircuitContext<PS>,
              nextDeadline_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  reportDefault(context: __compactRuntime.CircuitContext<PS>,
                leafCommitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  generateParticipationProof(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, Uint8Array>;
}

export type PureCircuits = {
}

export type Circuits<PS> = {
  createCircle(context: __compactRuntime.CircuitContext<PS>,
               amount_0: bigint,
               cap_0: bigint,
               rounds_0: bigint,
               duration_0: bigint,
               color_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  joinCircle(context: __compactRuntime.CircuitContext<PS>, deadline_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  contribute(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  claimPayout(context: __compactRuntime.CircuitContext<PS>,
              nextDeadline_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  reportDefault(context: __compactRuntime.CircuitContext<PS>,
                leafCommitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  generateParticipationProof(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, Uint8Array>;
}

export type Ledger = {
  readonly contributionAmount: bigint;
  readonly memberCap: bigint;
  readonly roundCount: bigint;
  readonly roundDuration: bigint;
  readonly currentRound: bigint;
  readonly circleStatus: number;
  memberTree: {
    isFull(): boolean;
    checkRoot(rt_0: { field: bigint }): boolean;
    root(): __compactRuntime.MerkleTreeDigest;
    firstFree(): bigint;
    pathForLeaf(index_0: bigint, leaf_0: Uint8Array): __compactRuntime.MerkleTreePath<Uint8Array>;
    findPathForLeaf(leaf_0: Uint8Array): __compactRuntime.MerkleTreePath<Uint8Array> | undefined
  };
  readonly memberCount: bigint;
  spentIdentifiers: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  readonly contributionsThisRound: bigint;
  readonly roundDeadline: bigint;
  readonly payoutClaimed: boolean;
  participationReceipts: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  readonly tokenColor: Uint8Array;
  payoutOrder: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: bigint): boolean;
    lookup(key_0: bigint): Uint8Array;
    [Symbol.iterator](): Iterator<[bigint, Uint8Array]>
  };
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
