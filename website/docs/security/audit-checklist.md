---
sidebar_position: 4
title: Audit Checklist
---

# Pre-Mainnet Audit Checklist

Before deploying Kosh to Midnight mainnet, the following should be verified by an independent security review.

## Cryptographic Correctness

- [ ] **Circuit soundness** — Formal verification that the Compact circuits implement the specification exactly. No underconstrained variables that could allow a prover to cheat.

- [ ] **Nullifier uniqueness** — Prove that no two distinct `(member, round)` pairs can produce the same nullifier under the Poseidon hash assumption. Verify there is no hash collision risk at the circuit's field size.

- [ ] **Merkle tree implementation** — Verify the Compact `MerkleTree` standard library implementation against known test vectors. Confirm the path verification (`merkleTreePathRoot`) is complete and sound.

- [ ] **Commitment binding** — Confirm that `persistentCommit(secret, nonce)` is computationally binding — a committed member cannot change their identity after joining.

## Privacy Properties

- [ ] **Witness isolation** — Confirm that witness function outputs (member secrets, nonces) are never transmitted outside the user's machine in the production architecture. In particular, verify the proof server receives only circuit inputs, not raw witness data.

- [ ] **Unlinkability proof** — Formally verify that identity commitments (`persistentCommit`) and round nullifiers (`persistentHash`) cannot be linked without knowledge of `memberSecret`. Document the exact cryptographic assumption.

- [ ] **Payout recipient privacy** — Verify that the `claimPayout` circuit does not leak the recipient's identity or Merkle position to observers beyond what is necessary.

## Liveness and Safety

- [ ] **Default detection completeness** — For any defaulting member, a valid `reportDefault` proof can always be constructed (liveness property). No edge case should prevent default reporting.

- [ ] **Default detection soundness** — An honest member who contributed cannot be falsely reported as a defaulter (safety property). The `!spentIdentifiers.member(roundId)` check must be sound.

- [ ] **Payout liveness** — For any member whose round arrives, the `claimPayout` circuit can always be called if they have their private state (no deadlock states).

- [ ] **Circle completion** — After `roundCount` rounds, the circle must always reach `COMPLETED` state (no stuck states).

## Economic Security

- [ ] **No fund extraction** — Verify there is no circuit path that allows extracting tokens from the pool without a valid proof.

- [ ] **Correct pool accounting** — After each round, `pool_balance = contributionAmount × contributionsThisRound`. After payout, `pool_balance = 0`.

- [ ] **Integer overflow** — Verify `contributionAmount × memberCap` cannot overflow `Uint<64>` at the maximum member cap (16 members × max amount).

## Infrastructure

- [ ] **Proof server security** — If using a hosted proof server in production, ensure TLS + witness encryption before any data leaves the user's machine.

- [ ] **Private state backup UX** — The user experience for secret backup and recovery is clear, tested, and prominently communicated on join.

- [ ] **DUST bootstrapping** — New users can obtain DUST for gas fees without a centralized faucet (or a clear bootstrapping path exists).

- [ ] **Compiler version pinning** — The exact Compact compiler version is pinned in the project. Verify that a compiler upgrade does not silently change circuit semantics.

## Cryptographic Primitives Reference

| Primitive | Compact Function | Security Basis |
|-----------|-----------------|----------------|
| Identity commitment | `persistentCommit(secret, nonce)` | Poseidon hash (ZK-friendly, collision resistant) |
| Round nullifier | `persistentHash(secret \|\| round)` | Poseidon hash (collision resistant) |
| Merkle tree | `MerkleTree<4, Bytes<32>>` | Binary Merkle tree with Poseidon hashing |
| Membership proof | `merkleTreePathRoot(path, leaf)` | Merkle inclusion proof (completeness + soundness) |
| ZK proof system | Halo2 / BLS12-381 | Industry-standard, deployed in Zcash ecosystem |
| Secret generation | Web Crypto `getRandomValues` | OS-level CSPRNG (cryptographically secure) |
| Token transfers | Zswap `send()` / `receive()` | Zswap protocol (ePrint 2022/1002) |
