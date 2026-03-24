---
sidebar_position: 4
title: State Machine
---

# State Machine

The circle lifecycle is encoded as an on-chain state machine. Every state transition is enforced by a ZK circuit — no organizer can skip or reverse a step.

## Circle Lifecycle

```
                    createCircle()
                          │
                          ▼
                     ┌─────────┐
                     │  OPEN   │
                     └────┬────┘
                          │ joinCircle() × memberCap
                          │ (last join auto-transitions)
                          ▼
                ┌─────────────────┐
                │ ROUND_IN_PROGRESS│◄──────────────────┐
                └────┬────────┬───┘                    │
                     │        │                        │
              all contributed  deadline passed          │
              before deadline  + missing contributions  │
                     │        │                        │
                     │        ▼                        │
                     │  ┌──────────────────┐           │
                     │  │ DEFAULT_DETECTED  │           │
                     │  └──────────────────┘           │
                     │                                  │
                     ▼                                  │
            ┌────────────────┐                         │
            │ PAYOUT_PENDING │                         │
            └───────┬────────┘                         │
                    │ claimPayout()                     │
                    │                                   │
                    ├── if rounds remain ───────────────┘
                    │
                    └── if all rounds done
                              │
                              ▼
                     ┌────────────────┐
                     │   COMPLETED    │
                     └────────────────┘
```

## States

| State | Description | How to enter |
|-------|-------------|-------------|
| `OPEN` | Accepting new members | Initial state after `createCircle()` |
| `ROUND_IN_PROGRESS` | Contributions being collected | Last member joins (auto) or round advances after payout |
| `PAYOUT_PENDING` | All members contributed; awaiting claim | `contributionsThisRound == memberCap` |
| `DEFAULT_DETECTED` | Round deadline passed with missing contributions | `blockTimeGte(roundDeadline) && contributionsThisRound < memberCap` |
| `COMPLETED` | All rounds finished, all payouts claimed | `currentRound == roundCount` after final `claimPayout()` |

## Round Lifecycle

Within `ROUND_IN_PROGRESS`, each round follows this internal flow:

```
Round N starts
    │
    ├── roundDeadline = currentBlockTime + roundDuration
    ├── contributionsThisRound = 0
    ├── payoutClaimed = false
    │
    │   Members contribute (any order, any time before deadline)
    │   Each contribution:
    │   - Verifies Merkle membership
    │   - Checks roundId not in spentIdentifiers
    │   - Adds roundId to spentIdentifiers
    │   - Sends contributionAmount NIGHT to pool
    │   - Increments contributionsThisRound
    │
    ├── If contributionsThisRound == memberCap:
    │       → status = PAYOUT_PENDING
    │       → Member at leafIndex == currentRound claims
    │       → Pool sent to recipient
    │       → currentRound++
    │       → If currentRound == roundCount: status = COMPLETED
    │       → Else: status = ROUND_IN_PROGRESS (next round)
    │
    └── If blockTime > roundDeadline AND contributionsThisRound < memberCap:
            → status = DEFAULT_DETECTED
            → reportDefault() can be called
```

## Circuit-to-State Mapping

| Circuit | Requires state | Produces state |
|---------|---------------|----------------|
| `createCircle` | (initial) | `OPEN` |
| `joinCircle` (n < cap) | `OPEN` | `OPEN` |
| `joinCircle` (n = cap) | `OPEN` | `ROUND_IN_PROGRESS` |
| `contribute` (partial) | `ROUND_IN_PROGRESS` | `ROUND_IN_PROGRESS` |
| `contribute` (last) | `ROUND_IN_PROGRESS` | `PAYOUT_PENDING` |
| `claimPayout` (rounds remain) | `PAYOUT_PENDING` | `ROUND_IN_PROGRESS` |
| `claimPayout` (last round) | `PAYOUT_PENDING` | `COMPLETED` |
| `reportDefault` | `ROUND_IN_PROGRESS` + deadline passed | `DEFAULT_DETECTED` |
| `generateParticipationProof` | `COMPLETED` | `COMPLETED` |

Each circuit has an assertion at the start that verifies the current state. An invalid state transition will cause the ZK proof to fail — the transaction is rejected by the node.
