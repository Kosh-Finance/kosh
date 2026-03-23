/**
 * Unit tests — witnesses.ts
 *
 * Tests the private state layer: secret generation, persistence,
 * and witness factory correctness.
 * These run without any Docker / network dependencies.
 */

import {
  generateMemberSecrets,
  saveMemberState,
  loadMemberState,
  createWitnesses,
  prepareContribution,
  preparePayout,
  type MemberPrivateState,
} from '../dapp/witnesses';

// ─── In-memory mock provider (matches PrivateStateProvider.set/get API) ────────

function createMockProvider() {
  const store = new Map<string, MemberPrivateState>();
  return {
    async set(key: string, value: MemberPrivateState) { store.set(key, value); },
    async get(key: string) { return store.get(key) ?? null; },
    async delete(key: string) { store.delete(key); },
    store, // expose for assertions
  } as any;
}

// ─── Mock WitnessContext factory ──────────────────────────────────────────────

function makeContext(ps: MemberPrivateState, leafIndex?: number) {
  const mockPath = {
    leaf: ps.memberNonce,
    path: Array.from({ length: 4 }, () => ({
      sibling: { field: 0n },
      goes_left: true,
    })),
  };
  return {
    privateState: ps,
    ledger: {
      memberTree: {
        pathForLeaf: (_idx: bigint, _leaf: Uint8Array) => mockPath,
        findPathForLeaf: (_leaf: Uint8Array) => mockPath,
        root: () => ({ field: 0n }),
        isFull: () => false,
        firstFree: () => BigInt(leafIndex ?? 0),
        checkRoot: () => true,
      },
    },
    contractAddress: { bytes: new Uint8Array(32) },
  } as any;
}

function makeState(overrides: Partial<MemberPrivateState> = {}): MemberPrivateState {
  const { memberSecret, memberNonce } = generateMemberSecrets();
  return {
    memberSecret,
    memberNonce,
    leafIndex: 2,
    circleId: '0xdeadbeef',
    joinedAt: 12345,
    recipientIsWallet: true,
    ...overrides,
  };
}

// ─── generateMemberSecrets ────────────────────────────────────────────────────

describe('generateMemberSecrets', () => {
  test('returns 32-byte secret and nonce', () => {
    const { memberSecret, memberNonce } = generateMemberSecrets();
    expect(memberSecret).toBeInstanceOf(Uint8Array);
    expect(memberNonce).toBeInstanceOf(Uint8Array);
    expect(memberSecret.byteLength).toBe(32);
    expect(memberNonce.byteLength).toBe(32);
  });

  test('generates unique secrets on each call', () => {
    const a = generateMemberSecrets();
    const b = generateMemberSecrets();
    expect(Buffer.from(a.memberSecret).equals(Buffer.from(b.memberSecret))).toBe(false);
    expect(Buffer.from(a.memberNonce).equals(Buffer.from(b.memberNonce))).toBe(false);
  });

  test('secret and nonce are independent', () => {
    const { memberSecret, memberNonce } = generateMemberSecrets();
    expect(Buffer.from(memberSecret).equals(Buffer.from(memberNonce))).toBe(false);
  });

  test('uses Web Crypto API (not Math.random)', () => {
    const spy = jest.spyOn(global.crypto, 'getRandomValues');
    generateMemberSecrets();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

// ─── saveMemberState / loadMemberState ────────────────────────────────────────

describe('saveMemberState + loadMemberState', () => {
  const CIRCLE_ID = '0xdeadbeef';

  test('roundtrips state correctly', async () => {
    const provider = createMockProvider();
    const original = makeState({ circleId: CIRCLE_ID });

    await saveMemberState(provider, CIRCLE_ID, original);
    const loaded = await loadMemberState(provider, CIRCLE_ID);

    expect(loaded).not.toBeNull();
    expect(Buffer.from(loaded!.memberSecret).equals(Buffer.from(original.memberSecret))).toBe(true);
    expect(Buffer.from(loaded!.memberNonce).equals(Buffer.from(original.memberNonce))).toBe(true);
    expect(loaded!.leafIndex).toBe(original.leafIndex);
    expect(loaded!.circleId).toBe(original.circleId);
    expect(loaded!.joinedAt).toBe(original.joinedAt);
  });

  test('returns null for unknown circle', async () => {
    const provider = createMockProvider();
    const result = await loadMemberState(provider, '0xunknown');
    expect(result).toBeNull();
  });

  test('state is scoped by circleId (no cross-circle leakage)', async () => {
    const provider = createMockProvider();
    const stateA = makeState({ circleId: '0xAAAA', leafIndex: 0 });
    const stateB = makeState({ circleId: '0xBBBB', leafIndex: 1 });

    await saveMemberState(provider, '0xAAAA', stateA);
    await saveMemberState(provider, '0xBBBB', stateB);

    const loadedA = await loadMemberState(provider, '0xAAAA');
    const loadedB = await loadMemberState(provider, '0xBBBB');

    expect(loadedA!.leafIndex).toBe(0);
    expect(loadedB!.leafIndex).toBe(1);
  });

  test('overwrites existing state', async () => {
    const provider = createMockProvider();
    await saveMemberState(provider, CIRCLE_ID, makeState({ leafIndex: 0 }));
    await saveMemberState(provider, CIRCLE_ID, makeState({ leafIndex: 5 }));
    const loaded = await loadMemberState(provider, CIRCLE_ID);
    expect(loaded!.leafIndex).toBe(5);
  });
});

// ─── createWitnesses ──────────────────────────────────────────────────────────

describe('createWitnesses', () => {
  test('memberSecret() returns saved secret', () => {
    const ps = makeState();
    const witnesses = createWitnesses();
    const ctx = makeContext(ps);
    const [_newPs, returned] = witnesses.memberSecret(ctx);
    expect(Buffer.from(returned).equals(Buffer.from(ps.memberSecret))).toBe(true);
  });

  test('memberSecret() returns unchanged privateState', () => {
    const ps = makeState();
    const witnesses = createWitnesses();
    const ctx = makeContext(ps);
    const [newPs] = witnesses.memberSecret(ctx);
    expect(newPs).toBe(ps); // same reference — not mutated
  });

  test('memberNonce() returns saved nonce', () => {
    const ps = makeState();
    const witnesses = createWitnesses();
    const ctx = makeContext(ps);
    const [, returned] = witnesses.memberNonce(ctx);
    expect(Buffer.from(returned).equals(Buffer.from(ps.memberNonce))).toBe(true);
  });

  test('memberMerklePath() calls pathForLeaf with member leaf index', () => {
    const ps = makeState({ leafIndex: 2 });
    const witnesses = createWitnesses();
    const pathForLeafSpy = jest.fn().mockReturnValue({
      leaf: ps.memberNonce,
      path: [],
    });
    const ctx = makeContext(ps);
    ctx.ledger.memberTree.pathForLeaf = pathForLeafSpy;

    witnesses.memberMerklePath(ctx);
    expect(pathForLeafSpy).toHaveBeenCalledWith(2n, ps.memberNonce);
  });

  test('memberMerklePath() returns path from ledger', () => {
    const ps = makeState({ leafIndex: 1 });
    const witnesses = createWitnesses();
    const mockPath = {
      leaf: ps.memberNonce,
      path: [{ sibling: { field: 42n }, goes_left: false }],
    };
    const ctx = makeContext(ps);
    ctx.ledger.memberTree.pathForLeaf = () => mockPath;

    const [, returned] = witnesses.memberMerklePath(ctx);
    expect(returned).toBe(mockPath);
  });

  test('inCoin() throws when no pendingInCoin', () => {
    const ps = makeState();
    const witnesses = createWitnesses();
    const ctx = makeContext(ps);
    expect(() => witnesses.inCoin(ctx)).toThrow('No pending contribution coin');
  });

  test('inCoin() returns coin and clears it from state', () => {
    const coin = {
      nonce: new Uint8Array(32).fill(1),
      color: new Uint8Array(32).fill(2),
      value: 1_000_000n,
    };
    const ps = prepareContribution(makeState(), coin);
    const witnesses = createWitnesses();
    const ctx = makeContext(ps);

    const [newPs, returnedCoin] = witnesses.inCoin(ctx);
    expect(Buffer.from(returnedCoin.nonce).equals(Buffer.from(coin.nonce))).toBe(true);
    expect(returnedCoin.value).toBe(1_000_000n);
    expect(newPs.pendingInCoin).toBeUndefined(); // cleared after use
  });

  test('outCoin() throws when no pendingOutCoin', () => {
    const ps = makeState();
    const witnesses = createWitnesses();
    const ctx = makeContext(ps);
    expect(() => witnesses.outCoin(ctx)).toThrow('No pending payout coin');
  });

  test('outCoin() returns coin and clears it from state', () => {
    const coin = {
      nonce: new Uint8Array(32).fill(3),
      color: new Uint8Array(32).fill(4),
      value: 4_000_000n,
      mt_index: 7n,
    };
    const ps = preparePayout(makeState(), coin, new Uint8Array(32).fill(5));
    const witnesses = createWitnesses();
    const ctx = makeContext(ps);

    const [newPs, returnedCoin] = witnesses.outCoin(ctx);
    expect(returnedCoin.value).toBe(4_000_000n);
    expect(returnedCoin.mt_index).toBe(7n);
    expect(newPs.pendingOutCoin).toBeUndefined();
  });

  test('payoutRecipient() throws when no pendingRecipientKey', () => {
    const ps = makeState();
    const witnesses = createWitnesses();
    const ctx = makeContext(ps);
    expect(() => witnesses.payoutRecipient(ctx)).toThrow('No payout recipient set');
  });

  test('payoutRecipient() wallet recipient: is_left=true', () => {
    const recipKey = new Uint8Array(32).fill(0xab);
    const coin = {
      nonce: new Uint8Array(32), color: new Uint8Array(32),
      value: 4_000_000n, mt_index: 0n,
    };
    const ps = preparePayout(makeState(), coin, recipKey, true);
    const witnesses = createWitnesses();
    const ctx = makeContext(ps);

    const [, either] = witnesses.payoutRecipient(ctx);
    expect(either.is_left).toBe(true);
    expect(Buffer.from(either.left.bytes).equals(Buffer.from(recipKey))).toBe(true);
  });

  test('payoutRecipient() contract recipient: is_left=false', () => {
    const recipKey = new Uint8Array(32).fill(0xcd);
    const coin = {
      nonce: new Uint8Array(32), color: new Uint8Array(32),
      value: 4_000_000n, mt_index: 0n,
    };
    const ps = preparePayout(makeState(), coin, recipKey, false);
    const witnesses = createWitnesses();
    const ctx = makeContext(ps);

    const [, either] = witnesses.payoutRecipient(ctx);
    expect(either.is_left).toBe(false);
    expect(Buffer.from(either.right.bytes).equals(Buffer.from(recipKey))).toBe(true);
  });
});

// ─── prepareContribution / preparePayout ─────────────────────────────────────

describe('prepareContribution', () => {
  test('adds pendingInCoin to state', () => {
    const ps = makeState();
    const coin = {
      nonce: new Uint8Array(32).fill(1),
      color: new Uint8Array(32).fill(2),
      value: 1_000_000n,
    };
    const updated = prepareContribution(ps, coin);
    expect(updated.pendingInCoin).toBeDefined();
    expect(updated.pendingInCoin!.value).toBe('1000000');
    expect(updated.pendingInCoin!.nonce).toHaveLength(32);
  });

  test('does not mutate original state', () => {
    const ps = makeState();
    const coin = { nonce: new Uint8Array(32), color: new Uint8Array(32), value: 1n };
    prepareContribution(ps, coin);
    expect(ps.pendingInCoin).toBeUndefined();
  });
});

describe('preparePayout', () => {
  test('adds pendingOutCoin and recipientKey to state', () => {
    const ps = makeState();
    const coin = {
      nonce: new Uint8Array(32).fill(1),
      color: new Uint8Array(32).fill(2),
      value: 4_000_000n,
      mt_index: 3n,
    };
    const key = new Uint8Array(32).fill(0xaa);
    const updated = preparePayout(ps, coin, key);
    expect(updated.pendingOutCoin).toBeDefined();
    expect(updated.pendingOutCoin!.mt_index).toBe('3');
    expect(updated.pendingRecipientKey).toBeDefined();
    expect(updated.recipientIsWallet).toBe(true);
  });

  test('does not mutate original state', () => {
    const ps = makeState();
    const coin = {
      nonce: new Uint8Array(32), color: new Uint8Array(32),
      value: 1n, mt_index: 0n,
    };
    preparePayout(ps, coin, new Uint8Array(32));
    expect(ps.pendingOutCoin).toBeUndefined();
  });
});
