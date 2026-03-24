---
sidebar_position: 3
title: Assumptions & Limitations
---

# Known Assumptions and Limitations

## Honest Organizer for Identity Resolution

The `reportDefault` circuit reveals only a commitment hash, not a real-world identity. Mapping from commitment → person requires an off-chain record maintained by the organizer.

**This is a deliberate design choice** that mirrors traditional ROSCA trust models: the group knows each other socially. The contract enforces the rules; the community handles identity.

**Implication:** If the organizer loses the off-chain mapping, defaulters cannot be identified in real-world terms (even though their commitment is on-chain).

**Post-Assemble mitigation:** An optional organizer-encrypted member record can be implemented. Members encrypt their real-world identity under the organizer's public key on join. The organizer can decrypt on default detection. The encrypted blob is stored off-chain (IPFS or organizer's server).

---

## Local State Loss

If a member loses their LevelDB private state (`~/.kosh/state`), they lose the ability to:
- Contribute to future rounds
- Claim their payout when their round arrives
- Generate a participation proof after completion

**Mitigation:** The app warns users on join and provides an export option. The secret can be exported as an encrypted mnemonic phrase. Users should store this securely (password manager, hardware key).

There is no on-chain recovery mechanism — the circuit requires the original secret to generate a valid proof. This is a fundamental tradeoff of the ZK privacy model.

---

## Proof Server on Local Machine

The proof server (Docker container on port 6300) receives circuit inputs for proof generation. In the current local-dev architecture, the proof server runs on the same machine as the user — **no data leaves the machine**.

**In a future hosted proof server scenario**, witness data would need to be transmitted securely. The correct production architecture is client-side proof generation (WASM in browser), which eliminates this risk entirely. This is on the [roadmap](/roadmap).

---

## Fixed Member Cap at Compile Time

The member cap is fixed at compile time due to Compact's bounded computation requirement (all loop iterations must be known at compile time).

**Implications:**
- A circle for 4 members and one for 8 members are **different compiled contracts**
- The cap cannot be changed after deployment
- Multiple contract variants are needed for different circle sizes

**Current implementation:** Compiled with `MerkleTree<4>` (depth 4 = max 16 members). Test with 4-member circles. Production can offer pre-compiled variants (4, 8, 16 members).

---

## Round-Robin Payout Ordering

The current implementation uses strict round-robin rotation: leaf position in the Merkle tree determines payout round order. Members who join first receive payouts in earlier rounds.

**Implication:** Later payout positions must wait longer for their capital. There is no mechanism to adjust order based on preference or urgency.

**Post-Assemble:** Bid-based payout ordering (members bid NIGHT to receive earlier) can be added using a sealed-bid commitment scheme within Compact circuits. This adds significant circuit complexity and is deferred.

---

## Single Contract Per Circle

Each savings circle is an independent deployed contract. There is no registry, factory, or hub contract.

**Implications:**
- Circle discovery requires sharing the contract address out-of-band
- No on-chain enumeration of all circles
- Each deployment requires a separate proof generation step

**Post-Assemble:** A lightweight registry contract can index circle addresses and basic parameters for discovery.
