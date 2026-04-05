/**
 * Unit tests — interact.ts
 *
 * Tests the new code added for milestone completion:
 *   - mapLedger: numeric CircleStatus → TypeScript string enum
 *   - contribute(): prepares pendingInCoin in private state before circuit
 *   - claimPayout(): prepares pendingOutCoin + recipientKey in private state before circuit
 *
 * All tests are network-free — external SDK modules are mocked.
 *
 * All @midnight-ntwrk packages are ESM-only (no CJS build). Jest mocks use
 * { virtual: true } so that jest.mock intercepts dynamic imports without
 * needing a CJS bundle on disk.
 */

import {
  CircleStatus,
  mapLedger,
  contribute,
  claimPayout,
} from '../dapp/interact';
import {
  saveMemberState,
  loadMemberState,
  generateMemberSecrets,
  type MemberPrivateState,
} from '../dapp/witnesses';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockCallTx: Record<string, jest.Mock> = {
  contribute: jest.fn(),
  claimPayout: jest.fn(),
};
const mockContractHandle = { callTx: mockCallTx };

jest.mock(
  '@midnight-ntwrk/compact-js',
  () => ({
    CompiledContract: {
      make: jest.fn((_name: string, ctor: unknown) => ({ ctor })),
      withWitnesses: jest.fn((cc: unknown) => cc),
    },
  }),
  { virtual: true },
);

jest.mock(
  '@midnight-ntwrk/midnight-js-contracts',
  () => ({ findDeployedContract: jest.fn(), getPublicStates: jest.fn() }),
  { virtual: true },
);

jest.mock(
  '@midnight-ntwrk/midnight-js-utils',
  () => ({
    fromHex: jest.fn((_hex: string) => new Uint8Array(32).fill(0xcc)),
    parseCoinPublicKeyToHex: jest.fn(() => 'cc'.repeat(32)),
    toHex: jest.fn(() => 'deadbeef'),
  }),
  { virtual: true },
);

jest.mock(
  '@midnight-ntwrk/midnight-js-network-id',
  () => ({ getNetworkId: jest.fn(() => 'preprod'), setNetworkId: jest.fn() }),
  { virtual: true },
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createMockProvider() {
  const store = new Map<string, MemberPrivateState>();
  let currentAddress = '';
  return {
    setContractAddress(addr: string) { currentAddress = addr; },
    async set(key: string, value: MemberPrivateState) { store.set(`${currentAddress}:${key}`, value); },
    async get(key: string) { return store.get(`${currentAddress}:${key}`) ?? null; },
    async delete(key: string) { store.delete(`${currentAddress}:${key}`); },
    store,
  } as any;
}

const TOKEN_COLOR = new Uint8Array(32).fill(0xab);

function makeMockLedger(overrides: {
  circleStatus?: number;
  currentRound?: number;
  contributionAmount?: bigint;
  memberCap?: number;
} = {}) {
  return {
    circleStatus:            overrides.circleStatus ?? 0,
    contributionAmount:      overrides.contributionAmount ?? 1_000_000n,
    memberCap:               overrides.memberCap ?? 4,
    roundCount:              4,
    roundDuration:           3600n,
    currentRound:            overrides.currentRound ?? 0,
    memberCount:             4,
    contributionsThisRound:  0,
    roundDeadline:           9_999_999_999n,
    payoutClaimed:           false,
    memberTree:              { root: new Uint8Array(32) },
    tokenColor:              TOKEN_COLOR,
  };
}

function makeState(leafIndex = 0, circleId = '0xCONTRACT'): MemberPrivateState {
  const { memberSecret, memberNonce } = generateMemberSecrets();
  return { memberSecret, memberNonce, leafIndex, circleId, joinedAt: 0, recipientIsWallet: true };
}

function makeProviders(privateStateProvider: any) {
  return {
    privateStateProvider,
    publicDataProvider: {} as any,
    zkConfigProvider:   {} as any,
    proofProvider:      {} as any,
  };
}

const CONTRACT_ADDRESS = '0xCONTRACT';
const CONTRACT_MODULE  = { Contract: {}, ledger: jest.fn() } as any;

// ─── mapLedger — circleStatus numeric mapping ─────────────────────────────────

describe('mapLedger — circleStatus', () => {
  test.each([
    [0, CircleStatus.OPEN],
    [1, CircleStatus.ROUND_IN_PROGRESS],
    [2, CircleStatus.PAYOUT_PENDING],
    [3, CircleStatus.DEFAULT_DETECTED],
    [4, CircleStatus.COMPLETED],
  ] as const)('numeric %i → %s', (numeric, expected) => {
    expect(mapLedger(makeMockLedger({ circleStatus: numeric })).circleStatus).toBe(expected);
  });

  test('unknown numeric falls back to OPEN', () => {
    expect(mapLedger(makeMockLedger({ circleStatus: 99 })).circleStatus).toBe(CircleStatus.OPEN);
  });

  test('maps tokenColor from ledger', () => {
    expect(mapLedger(makeMockLedger()).tokenColor).toEqual(TOKEN_COLOR);
  });

  test('converts numeric ledger fields to JS number/bigint', () => {
    const result = mapLedger(makeMockLedger());
    expect(typeof result.memberCap).toBe('number');
    expect(typeof result.roundCount).toBe('number');
    expect(typeof result.currentRound).toBe('number');
    expect(typeof result.contributionAmount).toBe('bigint');
  });
});

// ─── contribute() — pendingInCoin setup ──────────────────────────────────────

describe('contribute()', () => {
  let privateStateProvider: ReturnType<typeof createMockProvider>;

  beforeEach(async () => {
    jest.clearAllMocks();
    privateStateProvider = createMockProvider();

    const sdk = await import('@midnight-ntwrk/midnight-js-contracts') as any;
    sdk.getPublicStates.mockResolvedValue({ contractState: { data: {} } });
    sdk.findDeployedContract.mockResolvedValue(mockContractHandle);
    CONTRACT_MODULE.ledger.mockReturnValue(makeMockLedger({ circleStatus: 1 }));
    mockCallTx.contribute.mockResolvedValue({ public: { txHash: '0xabc', blockHeight: 10 } });
  });

  test('saves pendingInCoin with correct color and value before calling circuit', async () => {
    await saveMemberState(privateStateProvider, CONTRACT_ADDRESS, makeState(0));

    let capturedState: MemberPrivateState | null = null;
    mockCallTx.contribute.mockImplementation(async () => {
      capturedState = await loadMemberState(privateStateProvider, CONTRACT_ADDRESS);
      return { public: { txHash: '0xabc', blockHeight: 10 } };
    });

    await contribute(makeProviders(privateStateProvider), CONTRACT_ADDRESS, CONTRACT_MODULE);

    expect(capturedState).not.toBeNull();
    expect(capturedState!.pendingInCoin).toBeDefined();
    expect(capturedState!.pendingInCoin!.color).toEqual(TOKEN_COLOR);
    expect(capturedState!.pendingInCoin!.value).toBe('1000000');
    expect(capturedState!.pendingInCoin!.nonce).toHaveLength(32);
  });

  test('throws if not a member (no state)', async () => {
    await expect(
      contribute(makeProviders(privateStateProvider), CONTRACT_ADDRESS, CONTRACT_MODULE),
    ).rejects.toThrow('Not a member');
  });

  test('throws if leafIndex is -1 (pre-join state)', async () => {
    await saveMemberState(privateStateProvider, CONTRACT_ADDRESS, makeState(-1));
    await expect(
      contribute(makeProviders(privateStateProvider), CONTRACT_ADDRESS, CONTRACT_MODULE),
    ).rejects.toThrow('Not a member');
  });

  test('calls circuit exactly once', async () => {
    await saveMemberState(privateStateProvider, CONTRACT_ADDRESS, makeState(0));
    await contribute(makeProviders(privateStateProvider), CONTRACT_ADDRESS, CONTRACT_MODULE);
    expect(mockCallTx.contribute).toHaveBeenCalledTimes(1);
  });
});

// ─── claimPayout() — pendingOutCoin + recipientKey setup ─────────────────────

describe('claimPayout()', () => {
  let privateStateProvider: ReturnType<typeof createMockProvider>;

  const mockWalletApi = {
    getShieldedAddresses: jest.fn().mockResolvedValue({
      shieldedCoinPublicKey: 'mn1abc...',
      shieldedAddress: 'mn1xyz...',
      shieldedEncryptionPublicKey: 'mn1enc...',
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    privateStateProvider = createMockProvider();

    mockWalletApi.getShieldedAddresses.mockResolvedValue({
      shieldedCoinPublicKey: 'mn1abc...',
      shieldedAddress: 'mn1xyz...',
      shieldedEncryptionPublicKey: 'mn1enc...',
    });

    const utils = await import('@midnight-ntwrk/midnight-js-utils') as any;
    utils.parseCoinPublicKeyToHex.mockReturnValue('cc'.repeat(32));
    utils.fromHex.mockReturnValue(new Uint8Array(32).fill(0xcc));

    const sdk = await import('@midnight-ntwrk/midnight-js-contracts') as any;
    sdk.getPublicStates.mockResolvedValue({ contractState: { data: {} } });
    sdk.findDeployedContract.mockResolvedValue(mockContractHandle);
    CONTRACT_MODULE.ledger.mockReturnValue(makeMockLedger({ circleStatus: 2, currentRound: 0 }));
    mockCallTx.claimPayout.mockResolvedValue({ public: { txHash: '0xdef', blockHeight: 20 } });
  });

  test('saves pendingOutCoin and pendingRecipientKey before calling circuit', async () => {
    await saveMemberState(privateStateProvider, CONTRACT_ADDRESS, makeState(0));

    let capturedState: MemberPrivateState | null = null;
    mockCallTx.claimPayout.mockImplementation(async () => {
      capturedState = await loadMemberState(privateStateProvider, CONTRACT_ADDRESS);
      return { public: { txHash: '0xdef', blockHeight: 20 } };
    });

    await claimPayout(makeProviders(privateStateProvider), CONTRACT_ADDRESS, CONTRACT_MODULE, mockWalletApi);

    expect(capturedState).not.toBeNull();
    expect(capturedState!.pendingOutCoin).toBeDefined();
    expect(capturedState!.pendingRecipientKey).toBeDefined();
    expect(capturedState!.recipientIsWallet).toBe(true);
    // payoutAmount = contributionAmount × memberCap = 1_000_000 × 4
    expect(capturedState!.pendingOutCoin!.value).toBe('4000000');
    expect(capturedState!.pendingOutCoin!.color).toEqual(TOKEN_COLOR);
  });

  test('calls parseCoinPublicKeyToHex with Bech32m key and network ID', async () => {
    await saveMemberState(privateStateProvider, CONTRACT_ADDRESS, makeState(0));
    const utils = await import('@midnight-ntwrk/midnight-js-utils') as any;

    await claimPayout(makeProviders(privateStateProvider), CONTRACT_ADDRESS, CONTRACT_MODULE, mockWalletApi);

    expect(utils.parseCoinPublicKeyToHex).toHaveBeenCalledWith('mn1abc...', 'preprod');
  });

  test('throws if not a member', async () => {
    await expect(
      claimPayout(makeProviders(privateStateProvider), CONTRACT_ADDRESS, CONTRACT_MODULE, mockWalletApi),
    ).rejects.toThrow('Not a member');
  });

  test('throws if circle status is not PAYOUT_PENDING', async () => {
    CONTRACT_MODULE.ledger.mockReturnValue(makeMockLedger({ circleStatus: 1, currentRound: 0 }));
    await saveMemberState(privateStateProvider, CONTRACT_ADDRESS, makeState(0));
    await expect(
      claimPayout(makeProviders(privateStateProvider), CONTRACT_ADDRESS, CONTRACT_MODULE, mockWalletApi),
    ).rejects.toThrow('Payout not available');
  });

  test('throws if member slot does not match current round', async () => {
    // Member at slot 1, but current round is 0 → not their turn
    await saveMemberState(privateStateProvider, CONTRACT_ADDRESS, makeState(1));
    await expect(
      claimPayout(makeProviders(privateStateProvider), CONTRACT_ADDRESS, CONTRACT_MODULE, mockWalletApi),
    ).rejects.toThrow('Not your payout round');
  });

  test('returns amountReceived = contributionAmount × memberCap', async () => {
    await saveMemberState(privateStateProvider, CONTRACT_ADDRESS, makeState(0));
    const result = await claimPayout(
      makeProviders(privateStateProvider), CONTRACT_ADDRESS, CONTRACT_MODULE, mockWalletApi,
    );
    expect(result.amountReceived).toBe(4_000_000n);
  });
});
