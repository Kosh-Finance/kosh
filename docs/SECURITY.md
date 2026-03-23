# Kosh — Security & Privacy Analysis

**Version:** 1.0
**Author:** Kunal Drall
**Date:** March 2026
**Status:** Midnight Assemble Program — Active Build

---

## 1. Privacy Guarantees

### 1.1 What Is Private

| Data | Visibility | Mechanism |
|------|------------|-----------|
| Member identity | **Private** | Commitment stored in Merkle tree; secret + nonce stay in LevelDB |
| Which member contributed | **Private** | Round identifier uses different hash construction than identity commitment — unlinkable |
| Contribution amount (individual) | **Private** | Verified in-circuit; only aggregate pool balance is on-chain |
| Payout recipient identity | **Private** | Membership + position verified in-circuit; no identity disclosed |
| Participation history | **Private** | Member controls disclosure via participation proof |
| Member secrets and nonces | **Private** | Witness functions run locally; data never transmitted to proof server or node |

### 1.2 What Is Public

| Data | Visibility | Why |
|------|------------|-----|
| Circle parameters (amount, cap, rounds, duration) | **Public** | Required for group coordination; organizer discloses on creation |
| Circle status and current round | **Public** | Members need to know when to contribute |
| Merkle root of member commitments | **Public** | Required to verify membership proofs on-chain |
| Aggregate pool balance | **Public** | Transparency that contributions are received |
| Number of members joined | **Public** | Members can see if circle is filling up |
| Spent round identifiers (nullifiers) | **Public** | Required for double-contribution prevention |
| Defaulter commitment hash (conditional) | **Conditionally public** | Only revealed if default detected; only the defaulter's commitment |

### 1.3 The Unlinkability Property

The core privacy mechanism relies on two different cryptographic constructions that are computationally unlinkable:

**Identity commitment** (join):
```
commitment = persistentCommit(memberSecret, memberNonce)
```
- Stored in `MerkleTree<4, Bytes<32>>` on-chain
- `memberNonce` is random 32-byte value → same secret, different nonce → different commitment
- Used to prove membership: `merkleTreePathRoot(path, commitment) == merkleTree.root`

**Round nullifier** (contribute):
```
roundId = persistentHash(memberSecret || currentRound)
```
- Added to `Set<Bytes<32>>` (spentIdentifiers) on-chain
- No nonce → deterministic per (member, round) pair → enables double-contribution prevention
- Different hash construction than commitment → not linkable without knowing the secret

**Why they are unlinkable:**
An on-chain observer sees the Merkle tree of commitments and the set of nullifiers. To link them, they would need to find a (secret, nonce) pair such that both `persistentCommit(secret, nonce)` equals a known commitment AND `persistentHash(secret || round)` equals a known nullifier simultaneously. This requires inverting a one-way hash function — computationally infeasible under standard cryptographic assumptions (collision resistance of Poseidon/SHA-256, as used by Halo2/Compact).

---

## 2. Threat Model

### 2.1 Trusted Components

| Component | Trust Level | Reason |
|-----------|-------------|--------|
| Compact ZK circuits | **Trusted** | Compiled to formally verified Halo2 SNARKs |
| Midnight Network consensus | **Trusted** | Decentralized BFT consensus |
| User's local machine | **Trusted** | Witness functions execute locally; secrets stay local |
| Web Crypto API | **Trusted** | Browser-native CSPRNG for secret generation |

### 2.2 Untrusted Components

| Component | Trust Level | Reason |
|-----------|-------------|--------|
| Organizer (for identity mapping) | **Semi-trusted** | Holds off-chain commitment → identity mapping |
| Indexer GraphQL | **Untrusted for privacy** | Reads public ledger only; no secrets transmitted |
| Other circle members | **Untrusted** | Can see on-chain state but not individual identities |
| Proof server (Docker) | **Untrusted for data** | Receives circuit inputs; secrets must not be transmitted |

### 2.3 Attacker Models

#### Passive on-chain observer
**Goal:** Identify which member made which contribution.
**Available data:** Merkle tree of commitments, set of nullifiers, pool balance updates.
**Can they succeed?** No — nullifiers and commitments use different hash constructions. Linking them requires inverting a one-way function.

#### Malicious organizer
**Goal:** Deanonymize all members.
**Available data:** The organizer knows which commitments belong to which members (they facilitated the off-chain joining process).
**Can they succeed?** Yes, for identity mapping only — they can link a commitment to a real-world identity. They CANNOT determine which member contributed which round identifier (because round identifiers use `persistentHash(secret || round)`, not the commitment).
**Mitigation:** Use a trustless onboarding mechanism or accept this as a known assumption (social trust in the organizer, as in traditional ROSCAs).

#### Member collusion attack
**Goal:** Multiple members collude to identify who contributed/defaulted.
**Available data:** Their own secrets, on-chain nullifiers, on-chain commitments.
**Can they succeed?** Colluding members can determine each other's round identifiers from their own secrets. But they cannot determine other members' secrets from the public data alone.
**Mitigation:** Standard membership size limits (≤16) limit the attack surface. The ZK proofs are valid regardless of collusion.

#### Timing analysis
**Goal:** Link contribution timing to identity (e.g., "member X always contributes within 5 minutes of the round opening").
**Risk level:** Medium. If members contribute in highly predictable patterns (always first, always last), timing may leak partial information.
**Mitigation:** Encourage members to use randomized contribution timing within the round window.

#### Replay attack
**Goal:** Submit a previously valid contribution proof to the contract again.
**Can they succeed?** No — the nullifier (`roundId`) is added to `spentIdentifiers` on first use. Resubmitting the same proof would fail the `assert !spentIdentifiers.member(roundId)` check.

#### Double-contribution attack
**Goal:** Contribute twice in the same round (stealing from the pool).
**Can they succeed?** No — the nullifier is deterministic per (member, round) pair. The second attempt produces the same `roundId` which is already in `spentIdentifiers`. The assertion fails and the proof is rejected.

#### Non-member contribution attack
**Goal:** Contribute without being a registered member.
**Can they succeed?** No — the contribution circuit requires a valid Merkle membership proof. Without knowing a valid (secret, nonce) pair that maps to a leaf in the tree, the proof cannot be generated.

#### Wrong-round payout claim
**Goal:** Claim the payout in a round that isn't yours.
**Can they succeed?** No — the `claimPayout` circuit verifies the member's leaf index matches `currentRound`. The proof would fail if the leaf index doesn't match.

---

## 3. Known Assumptions and Limitations

### 3.1 Honest Organizer for Identity Resolution
The conditional deanonymization (reportDefault) reveals only a commitment hash, not a real-world identity. The mapping from commitment hash → person requires an off-chain record maintained by the organizer. This is a deliberate design choice that mirrors traditional ROSCA trust models: the group knows each other socially.

**Implication:** If the organizer loses the off-chain mapping, defaulters cannot be identified in real-world terms (even though their commitment is on-chain).

**Post-Assemble mitigation:** Implement an optional organizer-encrypted member record using the organizer's public key. Members encrypt their real-world identity under the organizer's key on join. The organizer can decrypt on default detection.

### 3.2 Local State Loss
If a member loses their LevelDB private state (`memberSecret`, `memberNonce`, `merklePath`), they lose the ability to:
- Contribute to future rounds
- Claim their payout
- Generate a participation proof

**Mitigation:** The DApp warns users on join and provides a "Back up your secret" prompt. The secret can be exported as an encrypted mnemonic phrase. This is documented in the UI.

### 3.3 Proof Server Isolation
The local proof server (Docker container on port 6300) receives circuit inputs for proof generation. The inputs include witness data. In the current local-dev architecture, the proof server runs on the same machine as the user, so no data leaves the machine.

**In a future hosted proof server scenario**, witness data would need to be transmitted securely. The correct architecture is client-side proof generation (WASM in browser), eliminating this risk. This is on the roadmap for the production deployment.

### 3.4 Compile-Time Member Cap
The member cap is fixed at compile time due to Compact's bounded computation requirement. This means:
- A circle for 4 members and one for 8 members are different compiled contracts
- You cannot dynamically change the member cap
- Multiple compiled variants may be needed for different circle sizes

**Impact:** Low. For the Assemble Program, we compile with `MerkleTree<4>` (max 16 members) and test with 4-member circles. Production deployment can offer pre-compiled variants (4, 8, 16).

### 3.5 Round-Robin Only (No Bid-Based Ordering)
The current implementation uses strict round-robin payout rotation (leaf position = payout round). This means:
- Later payout positions receive the time value benefit of longer lockup
- No mechanism to adjust payout order based on preference or bidding

**Post-Assemble:** Bid-based payout ordering (members bid to receive earlier) can be added using a sealed-bid commitment scheme within Compact circuits. This adds significant circuit complexity and is deferred to after the Assemble Program.

---

## 4. Cryptographic Primitives

| Primitive | Compact Function | Security Basis |
|-----------|-----------------|----------------|
| Identity commitment | `persistentCommit(secret, nonce)` | Poseidon hash (ZK-friendly, collision resistant) |
| Round nullifier | `persistentHash(secret \|\| round)` | Poseidon hash (collision resistant) |
| Merkle tree | `MerkleTree<4, Bytes<32>>` | Binary Merkle tree with Poseidon hashing |
| Membership proof | `merkleTreePathRoot(path, leaf)` | Merkle inclusion proof (completeness + soundness) |
| ZK proof system | Halo2 / BLS12-381 | Industry-standard, deployed in Zcash ecosystem |
| Secret generation | Web Crypto `getRandomValues` | OS-level CSPRNG (cryptographically secure) |
| Token transfers | Zswap `send()` / `receive()` | Zswap protocol (ePrint 2022/1002) |

---

## 5. Audit Checklist

Before mainnet deployment, the following should be verified:

- [ ] **Circuit soundness:** Formal verification that the Compact circuits implement the specification exactly. No underconstrained variables.
- [ ] **Nullifier uniqueness:** Prove that no two distinct (member, round) pairs can produce the same nullifier under the Poseidon hash assumption.
- [ ] **Merkle tree implementation:** Verify the Compact MerkleTree standard library implementation against known test vectors.
- [ ] **Witness isolation:** Confirm that witness function outputs are never transmitted outside the user's machine in the production architecture.
- [ ] **Default detection completeness:** For any defaulting member, a valid `reportDefault` proof can always be constructed (liveness property).
- [ ] **Default detection soundness:** An honest member who contributed cannot be falsely reported as a defaulter (safety property).
- [ ] **Proof server security:** If using a hosted proof server in production, ensure TLS + witness encryption before transmission.
- [ ] **Private state backup:** User experience for secret backup and recovery is clear and tested.
- [ ] **DUST bootstrapping:** New users can obtain DUST for gas fees without a centralized faucet.

---

## 6. References

- [Zswap Protocol](https://eprint.iacr.org/2022/1002) — ePrint 2022/1002
- [Halo2 Proof System](https://zcash.github.io/halo2/)
- [BLS12-381 Elliptic Curve](https://hackmd.io/@benjaminion/bls12-381)
- [Midnight Privacy Architecture](https://docs.midnight.network/concepts)
- [Compact Standard Library](https://docs.midnight.network/develop/reference/compact/compact-std-library/)
- [OpenZeppelin ZK Circuits 101](https://docs.openzeppelin.com/contracts-compact/zkcircuits101)
- B-ROSCA: Blockchain-based ROSCA — IEEE DAPPS 2023
- ChitChain — Springer 2021
