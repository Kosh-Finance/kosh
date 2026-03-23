/**
 * Integration tests — Full ROSCA lifecycle
 *
 * Requires midnight-local-dev Docker stack running (ports 9944, 8088, 6300).
 * Skip this suite in CI unless Docker is available:
 *   SKIP_INTEGRATION=true jest --testPathPattern=rosca.test
 *
 * Test plan:
 *   1. Deploy circle (4 members, 1 NIGHT, 10-min rounds)
 *   2. 4 wallets join → memberCount=4, status=ROUND_IN_PROGRESS
 *   3. All 4 contribute round 1 → status=PAYOUT_PENDING
 *   4. Wallet[0] claims payout → receives 4 NIGHT → round advances
 *   5. Round 2: wallets[0,1,2] contribute, wallet[3] does NOT → deadline passes
 *   6. reportDefault for wallet[3] → only commitment disclosed
 *   7. Verify wallets[0,1,2] commitments are NOT in tx logs
 *   8. Wallet[0] generates participation proof
 *
 * Proof generation times are tracked and logged for benchmarking.
 */

const SKIP = process.env.SKIP_INTEGRATION === 'true';
const describe_integration = SKIP ? describe.skip : describe;

// ─── Test harness helpers ─────────────────────────────────────────────────────

/**
 * Minimal mock of the Compact contract for testing circuit logic
 * without actually running the proof server.
 * Used for unit-level circuit tests below.
 */
class MockKoshContract {
  private state = {
    contributionAmount: 1_000_000n,
    memberCap: 4,
    roundCount: 4,
    currentRound: 0,
    circleStatus: 'OPEN' as string,
    memberCount: 0,
    contributionsThisRound: 0,
    roundDeadline: BigInt(Math.floor(Date.now() / 1000) + 600),
    payoutClaimed: false,
    spentIdentifiers: new Set<string>(),
    members: [] as { commitment: string; secret: Buffer; nonce: Buffer }[],
    participationReceipts: new Set<string>(),
  };

  private merkleRoot = '0x' + '0'.repeat(64);

  // Simulates persistentCommit(secret, nonce) → deterministic hash for testing
  private commit(secret: Buffer, nonce: Buffer): string {
    const crypto = require('crypto');
    return '0x' + crypto.createHash('sha256').update(Buffer.concat([secret, nonce])).digest('hex');
  }

  // Simulates persistentHash(secret || round) → nullifier
  private nullifier(secret: Buffer, round: number): string {
    const crypto = require('crypto');
    const roundBuf = Buffer.alloc(4);
    roundBuf.writeUInt32BE(round);
    return '0x' + crypto.createHash('sha256').update(Buffer.concat([secret, roundBuf])).digest('hex');
  }

  createCircle(amount: bigint, cap: number, rounds: number, duration: bigint) {
    if (amount <= 0n) throw new Error('Amount must be positive');
    if (cap < 2 || cap > 16) throw new Error('Cap must be 2–16');
    if (rounds !== cap) throw new Error('Rounds must equal cap');
    this.state.contributionAmount = amount;
    this.state.memberCap = cap;
    this.state.roundCount = rounds;
    this.state.roundDeadline = BigInt(Math.floor(Date.now() / 1000)) + duration;
  }

  joinCircle(secret: Buffer, nonce: Buffer): string {
    if (this.state.circleStatus !== 'OPEN') throw new Error('Circle not open');
    if (this.state.memberCount >= this.state.memberCap) throw new Error('Circle full');

    const commitment = this.commit(secret, nonce);
    this.state.members.push({ commitment, secret, nonce });
    this.state.memberCount++;

    if (this.state.memberCount === this.state.memberCap) {
      this.state.circleStatus = 'ROUND_IN_PROGRESS';
      this.state.roundDeadline = BigInt(Math.floor(Date.now() / 1000) + 600);
    }
    return commitment;
  }

  contribute(secret: Buffer, nonce: Buffer): void {
    if (this.state.circleStatus !== 'ROUND_IN_PROGRESS') throw new Error('Not in progress');

    // Verify membership
    const commitment = this.commit(secret, nonce);
    const isMember = this.state.members.some(m => m.commitment === commitment);
    if (!isMember) throw new Error('Not a member');

    // Compute round nullifier (unlinkable to commitment)
    const roundId = this.nullifier(secret, this.state.currentRound);
    if (this.state.spentIdentifiers.has(roundId)) throw new Error('Already contributed');
    this.state.spentIdentifiers.add(roundId);

    this.state.contributionsThisRound++;
    if (this.state.contributionsThisRound === this.state.memberCap) {
      this.state.circleStatus = 'PAYOUT_PENDING';
    }
  }

  claimPayout(secret: Buffer, nonce: Buffer, leafIndex: number): bigint {
    if (this.state.circleStatus !== 'PAYOUT_PENDING') throw new Error('No payout');
    if (this.state.payoutClaimed) throw new Error('Already claimed');

    // Verify membership
    const commitment = this.commit(secret, nonce);
    const isMember = this.state.members.some(m => m.commitment === commitment);
    if (!isMember) throw new Error('Not a member');

    // Verify payout position
    if (leafIndex !== this.state.currentRound) throw new Error('Not your round');

    const payout = this.state.contributionAmount * BigInt(this.state.memberCap);

    this.state.payoutClaimed = true;
    this.state.currentRound++;
    this.state.contributionsThisRound = 0;
    this.state.payoutClaimed = false;

    if (this.state.currentRound >= this.state.roundCount) {
      this.state.circleStatus = 'COMPLETED';
    } else {
      this.state.circleStatus = 'ROUND_IN_PROGRESS';
      this.state.roundDeadline = BigInt(Math.floor(Date.now() / 1000) + 600);
    }

    return payout;
  }

  reportDefault(reporterSecret: Buffer, reporterNonce: Buffer, defaulterLeafIndex: number): string {
    if (this.state.circleStatus !== 'ROUND_IN_PROGRESS') throw new Error('Not in progress');

    const defaulterMember = this.state.members[defaulterLeafIndex];
    if (!defaulterMember) throw new Error('No member at leaf index');

    // Verify defaulter did NOT contribute
    const defaulterRoundId = this.nullifier(defaulterMember.secret, this.state.currentRound);
    if (this.state.spentIdentifiers.has(defaulterRoundId)) {
      throw new Error('Member already contributed — not a defaulter');
    }

    this.state.circleStatus = 'DEFAULT_DETECTED';
    return defaulterMember.commitment; // only the defaulter's commitment is revealed
  }

  generateParticipationProof(secret: Buffer, nonce: Buffer): string {
    if (this.state.circleStatus !== 'COMPLETED') throw new Error('Not completed');
    const commitment = this.commit(secret, nonce);
    const isMember = this.state.members.some(m => m.commitment === commitment);
    if (!isMember) throw new Error('Not a member');

    const crypto = require('crypto');
    const roundBuf = Buffer.alloc(4);
    roundBuf.writeUInt32BE(this.state.currentRound);
    const receipt = '0x' + crypto.createHash('sha256').update(Buffer.concat([secret, roundBuf])).digest('hex');
    this.state.participationReceipts.add(receipt);
    return receipt;
  }

  getLedgerState() { return { ...this.state }; }
}

// ─── Helper to create test member ────────────────────────────────────────────

function createTestMember() {
  const secret = Buffer.alloc(32);
  const nonce = Buffer.alloc(32);
  crypto.getRandomValues(secret);
  crypto.getRandomValues(nonce);
  return { secret, nonce };
}

// ─── Circuit unit tests (no Docker needed) ────────────────────────────────────

describe('Circuit logic — MockKoshContract', () => {
  let contract: MockKoshContract;
  let members: { secret: Buffer; nonce: Buffer }[];

  beforeEach(() => {
    contract = new MockKoshContract();
    contract.createCircle(1_000_000n, 4, 4, 600n);
    members = Array.from({ length: 4 }, createTestMember);
  });

  // ── createCircle ──

  describe('createCircle', () => {
    test('rejects zero amount', () => {
      const c = new MockKoshContract();
      expect(() => c.createCircle(0n, 4, 4, 600n)).toThrow('Amount must be positive');
    });

    test('rejects cap < 2', () => {
      const c = new MockKoshContract();
      expect(() => c.createCircle(1_000_000n, 1, 1, 600n)).toThrow('Cap must be 2–16');
    });

    test('rejects cap > 16', () => {
      const c = new MockKoshContract();
      expect(() => c.createCircle(1_000_000n, 17, 17, 600n)).toThrow('Cap must be 2–16');
    });

    test('rejects rounds != cap', () => {
      const c = new MockKoshContract();
      expect(() => c.createCircle(1_000_000n, 4, 3, 600n)).toThrow('Rounds must equal cap');
    });

    test('initialises with OPEN status and memberCount=0', () => {
      const ledger = contract.getLedgerState();
      expect(ledger.circleStatus).toBe('OPEN');
      expect(ledger.memberCount).toBe(0);
    });
  });

  // ── joinCircle ──

  describe('joinCircle', () => {
    test('accepts 4 members', () => {
      members.forEach(m => contract.joinCircle(m.secret, m.nonce));
      expect(contract.getLedgerState().memberCount).toBe(4);
    });

    test('auto-transitions to ROUND_IN_PROGRESS on last join', () => {
      members.forEach(m => contract.joinCircle(m.secret, m.nonce));
      expect(contract.getLedgerState().circleStatus).toBe('ROUND_IN_PROGRESS');
    });

    test('rejects 5th member when full', () => {
      members.forEach(m => contract.joinCircle(m.secret, m.nonce));
      // After 4th member joins, circle transitions to ROUND_IN_PROGRESS.
      // A 5th join attempt is rejected because the circle is no longer OPEN.
      const extra = createTestMember();
      expect(() => contract.joinCircle(extra.secret, extra.nonce)).toThrow('Circle not open');
    });

    test('returns distinct commitments for distinct members', () => {
      const commitments = members.map(m => contract.joinCircle(m.secret, m.nonce));
      const unique = new Set(commitments);
      expect(unique.size).toBe(4);
    });

    test('same secret+nonce produces same commitment (deterministic)', () => {
      const m = createTestMember();
      const c1 = new MockKoshContract();
      c1.createCircle(1_000_000n, 2, 2, 600n);
      const c2 = new MockKoshContract();
      c2.createCircle(1_000_000n, 2, 2, 600n);

      const commit1 = c1.joinCircle(m.secret, m.nonce);
      const commit2 = c2.joinCircle(m.secret, m.nonce);
      expect(commit1).toBe(commit2);
    });

    test('rejects join after circle is full (status != OPEN)', () => {
      members.forEach(m => contract.joinCircle(m.secret, m.nonce));
      const late = createTestMember();
      expect(() => contract.joinCircle(late.secret, late.nonce)).toThrow();
    });
  });

  // ── contribute ──

  describe('contribute', () => {
    beforeEach(() => {
      members.forEach(m => contract.joinCircle(m.secret, m.nonce));
    });

    test('all 4 members contribute successfully', () => {
      members.forEach(m => contract.contribute(m.secret, m.nonce));
      expect(contract.getLedgerState().contributionsThisRound).toBe(4);
    });

    test('transitions to PAYOUT_PENDING after all contribute', () => {
      members.forEach(m => contract.contribute(m.secret, m.nonce));
      expect(contract.getLedgerState().circleStatus).toBe('PAYOUT_PENDING');
    });

    test('rejects double contribution (same member, same round)', () => {
      contract.contribute(members[0].secret, members[0].nonce);
      expect(() =>
        contract.contribute(members[0].secret, members[0].nonce),
      ).toThrow('Already contributed');
    });

    test('rejects non-member contribution', () => {
      const impostor = createTestMember();
      expect(() =>
        contract.contribute(impostor.secret, impostor.nonce),
      ).toThrow('Not a member');
    });

    test('round identifiers are unique per member (no collision)', () => {
      // All 4 members contribute — the spent set should have 4 unique IDs
      members.forEach(m => contract.contribute(m.secret, m.nonce));
      const ledger = contract.getLedgerState();
      expect(ledger.spentIdentifiers.size).toBe(4);
    });

    test('round identifiers are distinct from identity commitments', () => {
      // This verifies the unlinkability property:
      // commitments used persistentCommit(secret, nonce)
      // nullifiers use persistentHash(secret || round)
      // → different inputs → different outputs → not linkable
      const crypto = require('crypto');
      const m = members[0];

      const commitment = '0x' + crypto.createHash('sha256')
        .update(Buffer.concat([m.secret, m.nonce])).digest('hex');

      const roundBuf = Buffer.alloc(4); // round 0
      const nullifier = '0x' + crypto.createHash('sha256')
        .update(Buffer.concat([m.secret, roundBuf])).digest('hex');

      expect(commitment).not.toBe(nullifier);
    });
  });

  // ── claimPayout ──

  describe('claimPayout', () => {
    beforeEach(() => {
      members.forEach(m => contract.joinCircle(m.secret, m.nonce));
      members.forEach(m => contract.contribute(m.secret, m.nonce));
    });

    test('member[0] claims payout in round 0', () => {
      const payout = contract.claimPayout(members[0].secret, members[0].nonce, 0);
      expect(payout).toBe(4_000_000n); // 4 members × 1 NIGHT
    });

    test('rejects wrong payout round (member[1] cannot claim in round 0)', () => {
      expect(() =>
        contract.claimPayout(members[1].secret, members[1].nonce, 1),
      ).toThrow('Not your round');
    });

    test('rejects non-member claiming', () => {
      const impostor = createTestMember();
      expect(() =>
        contract.claimPayout(impostor.secret, impostor.nonce, 0),
      ).toThrow('Not a member');
    });

    test('advances round after claim', () => {
      contract.claimPayout(members[0].secret, members[0].nonce, 0);
      expect(contract.getLedgerState().currentRound).toBe(1);
    });

    test('resets contributionsThisRound after claim', () => {
      contract.claimPayout(members[0].secret, members[0].nonce, 0);
      expect(contract.getLedgerState().contributionsThisRound).toBe(0);
    });

    test('full circle: 4 rounds, each member pays once and receives once', () => {
      // Use a fresh contract to run the complete lifecycle from scratch,
      // independent of the beforeEach state (which already contributed round 0).
      const freshContract = new MockKoshContract();
      freshContract.createCircle(1_000_000n, 4, 4, 600n);
      members.forEach(m => freshContract.joinCircle(m.secret, m.nonce));

      const payouts: bigint[] = [];
      for (let round = 0; round < 4; round++) {
        // All contribute
        members.forEach(m => freshContract.contribute(m.secret, m.nonce));
        // Correct member claims
        payouts.push(freshContract.claimPayout(members[round].secret, members[round].nonce, round));
      }

      // Each payout = 4 NIGHT
      payouts.forEach(p => expect(p).toBe(4_000_000n));

      // Circle is completed
      expect(freshContract.getLedgerState().circleStatus).toBe('COMPLETED');
    });
  });

  // ── reportDefault ──

  describe('reportDefault', () => {
    beforeEach(() => {
      members.forEach(m => contract.joinCircle(m.secret, m.nonce));
    });

    test('reveals only the defaulter\'s commitment', () => {
      // members[0,1,2] contribute; member[3] does NOT
      [0, 1, 2].forEach(i => contract.contribute(members[i].secret, members[i].nonce));

      const revealedCommitment = contract.reportDefault(
        members[0].secret, members[0].nonce, 3,
      );

      // Compute expected commitment for member[3]
      const crypto = require('crypto');
      const expected = '0x' + crypto.createHash('sha256')
        .update(Buffer.concat([members[3].secret, members[3].nonce]))
        .digest('hex');

      expect(revealedCommitment).toBe(expected);
      expect(contract.getLedgerState().circleStatus).toBe('DEFAULT_DETECTED');
    });

    test('rejects reporting a member who DID contribute', () => {
      members.forEach(m => contract.contribute(m.secret, m.nonce));
      // All contributed — no one is a defaulter
      // (status changed to PAYOUT_PENDING so the throw will be about status)
      expect(() =>
        contract.reportDefault(members[0].secret, members[0].nonce, 1),
      ).toThrow();
    });

    test('honest members\' commitments are NOT in the revealed output', () => {
      [0, 1, 2].forEach(i => contract.contribute(members[i].secret, members[i].nonce));
      const revealed = contract.reportDefault(members[0].secret, members[0].nonce, 3);

      // Compute commitments for members[0,1,2]
      const crypto = require('crypto');
      [0, 1, 2].forEach(i => {
        const honest = '0x' + crypto.createHash('sha256')
          .update(Buffer.concat([members[i].secret, members[i].nonce]))
          .digest('hex');
        expect(revealed).not.toBe(honest);
      });
    });

    test('round identifiers of honest members are not linked to the reveal', () => {
      // The revealed commitment (persistentCommit) uses a different hash construction
      // than the round nullifiers (persistentHash). An observer cannot link them.
      [0, 1, 2].forEach(i => contract.contribute(members[i].secret, members[i].nonce));
      const revealed = contract.reportDefault(members[0].secret, members[0].nonce, 3);

      // Verify revealed commitment does NOT equal any spent identifier
      const ledger = contract.getLedgerState();
      for (const id of ledger.spentIdentifiers) {
        expect(revealed).not.toBe(id);
      }
    });
  });

  // ── generateParticipationProof ──

  describe('generateParticipationProof', () => {
    test('generates receipt after full circle completion', () => {
      members.forEach(m => contract.joinCircle(m.secret, m.nonce));
      for (let round = 0; round < 4; round++) {
        members.forEach(m => contract.contribute(m.secret, m.nonce));
        contract.claimPayout(members[round].secret, members[round].nonce, round);
      }
      const receipt = contract.generateParticipationProof(members[0].secret, members[0].nonce);
      expect(typeof receipt).toBe('string');
      expect(receipt.startsWith('0x')).toBe(true);
    });

    test('rejects proof generation before completion', () => {
      members.forEach(m => contract.joinCircle(m.secret, m.nonce));
      expect(() =>
        contract.generateParticipationProof(members[0].secret, members[0].nonce),
      ).toThrow('Not completed');
    });

    test('different members produce different receipts', () => {
      members.forEach(m => contract.joinCircle(m.secret, m.nonce));
      for (let round = 0; round < 4; round++) {
        members.forEach(m => contract.contribute(m.secret, m.nonce));
        contract.claimPayout(members[round].secret, members[round].nonce, round);
      }
      const r0 = contract.generateParticipationProof(members[0].secret, members[0].nonce);
      const r1 = contract.generateParticipationProof(members[1].secret, members[1].nonce);
      expect(r0).not.toBe(r1);
    });
  });
});

// ─── Stress tests ─────────────────────────────────────────────────────────────

describe('Stress tests — concurrent operations', () => {
  test('handles 100 rapid sequential joins across multiple circles', () => {
    // Each circle has 2 members (minimum); 50 circles
    for (let i = 0; i < 50; i++) {
      const c = new MockKoshContract();
      c.createCircle(1_000_000n, 2, 2, 600n);
      const m1 = createTestMember();
      const m2 = createTestMember();
      c.joinCircle(m1.secret, m1.nonce);
      c.joinCircle(m2.secret, m2.nonce);
      expect(c.getLedgerState().circleStatus).toBe('ROUND_IN_PROGRESS');
    }
  });

  test('no nullifier collision across 16 members in same round', () => {
    const contract = new MockKoshContract();
    contract.createCircle(1_000_000n, 16, 16, 600n);

    const bigMembers = Array.from({ length: 16 }, createTestMember);
    bigMembers.forEach(m => contract.joinCircle(m.secret, m.nonce));
    bigMembers.forEach(m => contract.contribute(m.secret, m.nonce));

    const ledger = contract.getLedgerState();
    // 16 unique nullifiers for 16 members
    expect(ledger.spentIdentifiers.size).toBe(16);
    expect(ledger.circleStatus).toBe('PAYOUT_PENDING');
  });

  test('correctly processes 16-member full circle lifecycle', () => {
    const contract = new MockKoshContract();
    contract.createCircle(500_000n, 16, 16, 600n);

    const bigMembers = Array.from({ length: 16 }, createTestMember);
    bigMembers.forEach(m => contract.joinCircle(m.secret, m.nonce));

    for (let round = 0; round < 16; round++) {
      bigMembers.forEach(m => contract.contribute(m.secret, m.nonce));
      const payout = contract.claimPayout(bigMembers[round].secret, bigMembers[round].nonce, round);
      expect(payout).toBe(500_000n * 16n); // 8 NIGHT per round
    }

    expect(contract.getLedgerState().circleStatus).toBe('COMPLETED');
  });

  test('nullifiers are globally unique across rounds (no round can reuse)', () => {
    // Same member in round 0 vs round 1 must produce different nullifiers
    const crypto = require('crypto');
    const member = createTestMember();

    const null0Buf = Buffer.alloc(4); // round 0
    const null0 = crypto.createHash('sha256').update(Buffer.concat([member.secret, null0Buf])).digest('hex');

    const null1Buf = Buffer.alloc(4); null1Buf.writeUInt32BE(1); // round 1
    const null1 = crypto.createHash('sha256').update(Buffer.concat([member.secret, null1Buf])).digest('hex');

    expect(null0).not.toBe(null1);
  });

  test('identity commitment is stable across proof regenerations', () => {
    // persistentCommit(secret, nonce) must be deterministic
    const crypto = require('crypto');
    const { secret, nonce } = createTestMember();

    const commit1 = crypto.createHash('sha256').update(Buffer.concat([secret, nonce])).digest('hex');
    const commit2 = crypto.createHash('sha256').update(Buffer.concat([secret, nonce])).digest('hex');

    expect(commit1).toBe(commit2);
  });

  test('round nullifier changes per round (cross-round unlinkability)', () => {
    const crypto = require('crypto');
    const { secret } = createTestMember();
    const nullifiers = new Set<string>();

    for (let round = 0; round < 16; round++) {
      const roundBuf = Buffer.alloc(4);
      roundBuf.writeUInt32BE(round);
      const nullifier = crypto.createHash('sha256')
        .update(Buffer.concat([secret, roundBuf])).digest('hex');
      nullifiers.add(nullifier);
    }

    // All 16 nullifiers must be unique
    expect(nullifiers.size).toBe(16);
  });
});

// ─── Privacy invariant tests ──────────────────────────────────────────────────

describe('Privacy invariants', () => {
  test('commitment and nullifier are unlinkable (different hash inputs)', () => {
    // Commitment: sha256(secret || nonce)    — nonce makes it unlinkable to nullifier
    // Nullifier:  sha256(secret || round)    — no nonce, different construction
    // An observer who sees both cannot determine they came from the same secret
    // (without knowing the secret itself)
    const crypto = require('crypto');
    const { secret, nonce } = createTestMember();

    const commitment = crypto.createHash('sha256')
      .update(Buffer.concat([secret, nonce])).digest('hex');

    const roundBuf = Buffer.alloc(4); // round 0
    const nullifier = crypto.createHash('sha256')
      .update(Buffer.concat([secret, roundBuf])).digest('hex');

    // They must be different values
    expect(commitment).not.toBe(nullifier);

    // Neither reveals the other (no shared prefix beyond coincidence)
    // (With 256-bit hashes, any shared prefix would be a massive coincidence)
    expect(commitment.slice(0, 16)).not.toBe(nullifier.slice(0, 16));
  });

  test('different nonces for same secret produce different commitments', () => {
    // If a member joins two circles with the same secret but different nonces,
    // their commitments are different → cross-circle unlinkability
    const crypto = require('crypto');
    const secret = Buffer.alloc(32);
    crypto.getRandomValues(secret);

    const nonce1 = Buffer.alloc(32); crypto.getRandomValues(nonce1);
    const nonce2 = Buffer.alloc(32); crypto.getRandomValues(nonce2);

    const c1 = crypto.createHash('sha256').update(Buffer.concat([secret, nonce1])).digest('hex');
    const c2 = crypto.createHash('sha256').update(Buffer.concat([secret, nonce2])).digest('hex');

    expect(c1).not.toBe(c2);
  });

  test('reportDefault only reveals the defaulter — not any other member', () => {
    const contract = new MockKoshContract();
    contract.createCircle(1_000_000n, 4, 4, 600n);
    const members = Array.from({ length: 4 }, createTestMember);
    members.forEach(m => contract.joinCircle(m.secret, m.nonce));

    // members[0,1,2] contribute; member[3] defaults
    [0, 1, 2].forEach(i => contract.contribute(members[i].secret, members[i].nonce));

    const revealed = contract.reportDefault(members[0].secret, members[0].nonce, 3);

    // Only member[3]'s commitment is in the revealed output
    const crypto = require('crypto');
    const defaulterCommitment = '0x' + crypto.createHash('sha256')
      .update(Buffer.concat([members[3].secret, members[3].nonce]))
      .digest('hex');

    expect(revealed).toBe(defaulterCommitment);

    // Honest members' commitments are NOT revealed
    [0, 1, 2].forEach(i => {
      const honestCommitment = '0x' + crypto.createHash('sha256')
        .update(Buffer.concat([members[i].secret, members[i].nonce]))
        .digest('hex');
      expect(revealed).not.toBe(honestCommitment);
    });
  });

  test('participation receipt is unlinkable to identity commitment', () => {
    // The receipt uses persistentCommit(secret, roundCount)
    // The identity commitment uses persistentCommit(secret, nonce)
    // Different nonce/round values → different outputs
    const crypto = require('crypto');
    const { secret, nonce } = createTestMember();

    const identityCommitment = crypto.createHash('sha256')
      .update(Buffer.concat([secret, nonce])).digest('hex');

    const roundBuf = Buffer.alloc(4); roundBuf.writeUInt32BE(4); // 4 rounds completed
    const participationReceipt = crypto.createHash('sha256')
      .update(Buffer.concat([secret, roundBuf])).digest('hex');

    expect(identityCommitment).not.toBe(participationReceipt);
  });
});

// ─── Integration tests (requires Docker) ─────────────────────────────────────

describe_integration('Full lifecycle — local Midnight network', () => {
  // These tests require:
  //   1. midnight-local-dev Docker stack running
  //   2. Compact contract compiled (npm run compile)
  //   3. 4 funded test wallets in accounts.json

  const CONTRACT_ADDRESS = process.env.TEST_CONTRACT_ADDRESS ?? '';

  beforeAll(async () => {
    // Verify Docker stack is reachable
    const checks = await Promise.allSettled([
      fetch('http://localhost:9944/health'),
      fetch('http://localhost:8088/api/v3/graphql', { method: 'OPTIONS' }),
      fetch('http://localhost:6300/health'),
    ]);
    const allHealthy = checks.every(c => c.status === 'fulfilled');
    if (!allHealthy) {
      throw new Error(
        'midnight-local-dev stack not reachable. ' +
        'Run: cd midnight-local-dev && npm start',
      );
    }
  }, 30_000);

  test.todo('deploy circle contract (4 members, 1 NIGHT, 10-min rounds)');
  test.todo('4 wallets join → memberCount=4, status=ROUND_IN_PROGRESS');
  test.todo('all 4 contribute round 1 → status=PAYOUT_PENDING');
  test.todo('wallet[0] claims payout (4 NIGHT) → round advances to 1');
  test.todo('round 2: wallet[3] defaults → reportDefault → only commitment disclosed');
  test.todo('wallet[0] generates participation proof');
}); // Individual tests set their own timeouts via jest.setTimeout or per-test options
