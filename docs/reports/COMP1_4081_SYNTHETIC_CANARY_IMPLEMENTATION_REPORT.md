# COMP1 #4081 — Source-Only Synthetic Canary Lifecycle Harness

**Issue:** #4081 (parent #3461)
**PR:** #4090 (Draft)
**Date:** 2026-08-17
**Author:** skerishKang (Web Developer implementation) / Web CTO review pending
**Status:** READY=NO, MERGE=NO. Draft PR for independent Web CTO exact-head review.

---

## 1. Objective

Implement a pure, dependency-injected **source authority** that models the
synthetic canary write/read/cleanup lifecycle for Issue #4081. The harness carries
**zero runtime capability** (no network, database, provider, SQL, filesystem write,
process, timer, retry, alert, scheduler, or deployment). Every effect — QA auth,
fixture identity, memory write dispatch, canonical reread, owner read, cleanup,
fence, the #4080 write-outcome classifier, and optional visibility/browse observers —
is **injected**. Real auth/network/DB writes = 0.

---

## 2. Deliverables

| File | Type | Lines | Notes |
|------|------|-------|-------|
| `js/observability/reliability-canary-lifecycle-core.js` | Source authority | 588 | New. Frozen pure API. |
| `tests/contracts/reliability-canary-lifecycle-core-4081.test.cjs` | Contract test | 562 | New. 45 cases. |
| `tests/test-layer-classification.json` | Classification | +6 | New `EXECUTED_FAKE` entry for the above test. |

No modification to any existing authority (`reliability-baseline-store-contract.js`,
`reliability-anomaly-evaluator-core.js`, structural sentinel core/catalog, #4080
classifier source). Only the two new files plus the one-classification-entry
integration were added.

---

## 3. State Model

### Lifecycle stages (`LIFECYCLE_STAGES`)
```
IDLE
  -> AUTH_ACQUIRED
  -> FIXTURE_READY
  -> MEMORY_WRITE_DISPATCHED
  -> MEMORY_WRITE_ACKNOWLEDGED
  -> CANONICAL_REREAD_CONFIRMED
  -> OWNER_READ_CONFIRMED
  -> VISIBILITY_OBSERVED
```

### Terminal states (`TERMINAL_STATES`)
- `CLEANUP_CONFIRMED`
- `FIXTURE_RETAINED_DETERMINISTIC` (deterministic retained recovery)

### Failure / control terminals (`FAILURE_STATES`)
- `BOUNDED_STAGE_FAILURE`
- `CLEANUP_FAILED`
- `FENCED`

### Synthetic visibility — always private, never Browse eligible
- `SYNTHETIC_VISIBILITY.VISIBILITY = PRIVATE`
- `SYNTHETIC_VISIBILITY.BROWSE_ELIGIBLE = NON_BROWSE_ELIGIBLE`

### Fixed synthetic-exclusion marker (provenance boundary, pre-aggregation)
- `SYNTHETIC_EXCLUSION = SYNTHETIC_CANARY_EXCLUDED`

---

## 4. Critical Safety Contracts (verified by tests)

1. **QA identity is opaque.** No raw credential/email/UID/owner/tree/memory id/fixture
   id/fence token/connection string/raw count/real content is emitted. `PRIVATE_KEYS`
   rejected on input and output.
2. **Ownership re-verified before every mutation and cleanup.** Mismatch →
   `FENCED` → `STOP_SYNTHETIC_WRITES` + `OWNER_DECISION_REQUIRED`.
3. **Concurrent-run fencing.** `acquire(runKey, boundedExpiry)` /
   `assertCurrent(fence)` / `renew(fence)` / `release(fence)`. Stale or superseded
   runner can neither write nor clean up. Fencing authority unavailable ⇒ fail
   closed (mutation = 0).
4. **`WRITE_STATUS_UNKNOWN` (#4080) is `retry_safe=false`.** No blind retry; canonical
   reread/reconciliation must run first. Residual ambiguity ⇒
   `STOP_SYNTHETIC_WRITES` + `OWNER_DECISION_REQUIRED`.
5. **Standard canary is ALWAYS PRIVATE and NON_BROWSE_ELIGIBLE.** No API to
   self-promote. Unexpected observed Browse eligibility ⇒ fail closed
   (`STOP_SYNTHETIC_WRITES`).
6. **ACK ≠ canonical reread confirmation.** The #4080 `WRITE_ACKNOWLEDGED !=
   CANONICAL_REREAD_CONFIRMED` boundary is preserved; no write acknowledgement is
   ever treated as a canonical reread confirmation.
7. **Synthetic fixtures carry a fixed exclusion marker** and are separated from user
   baselines/metrics at the provenance boundary. No Production schema field invented.
8. **#3835 vocabulary reused, not redefined.** `STOP_SYNTHETIC_WRITES` and
   `OWNER_DECISION_REQUIRED` come from the injected taxonomy; no new public action
   enum and no retry authority invented.

---

## 5. Test Matrix (45 cases, all passing)

| # | Scenario | Expected terminal |
|---|----------|-------------------|
| 1-9 | API shape, frozen authority, dependency validation, invalid run key | throws / frozen |
| 10 | Normal lifecycle | `CLEANUP_CONFIRMED` |
| 11 | Retained cleanup | `FIXTURE_RETAINED_DETERMINISTIC` |
| 12 | `WRITE_STATUS_UNKNOWN` (no blind retry) | `BOUNDED_STAGE_FAILURE` + `OWNER_DECISION_REQUIRED` |
| 13 | Canonical reread missing | `BOUNDED_STAGE_FAILURE` |
| 14 | Owner read failure in authority gate | `FENCED` |
| 15 | Ownership mismatch | `FENCED` + `OWNER_DECISION_REQUIRED` |
| 16-18 | Fence unavailable / rejected / stale | `FENCED` |
| 19-22 | Dispatch / cleanup / auth / fixture failure | `BOUNDED_STAGE_FAILURE` |
| 23 | Browse eligibility detected (promotion trap) | `FENCED` + `STOP_SYNTHETIC_WRITES` |
| 24 | Visibility observer failure | `BOUNDED_STAGE_FAILURE` |
| 25-26 | Frozen result, only bounded fields, no private keys | ok |
| 27-28 | `isValidRunKey` / `isValidReleaseSha` boundaries | ok |
| 29-30 | Deterministic repeat, caller-input non-mutation | ok |
| 31 | No forbidden runtime capability in source | ok |
| 32 | Fixture privacy-key leak rejected | `BOUNDED_STAGE_FAILURE` |
| 33 | Classifier unavailability fails closed | throws |
| 34-36 | `isPlainRecord` / `hasPrivateKeyIn` / `PRIVATE_KEYS` | ok |
| 38-40 | Fixed `SYNTHETIC_EXCLUSION` marker on all results | ok |
| 41-45 | `resume === run`, null fixture, fence throw, classifier throw, expiry options | ok |

---

## 6. Verification Evidence

| Check | Result |
|-------|--------|
| Focused #4081 test | **45/45 pass** |
| Regression #4079 (baseline anomaly) | 21/21 pass |
| Regression #4080 (write-reread classifier) | 35/35 pass |
| #3835/#3461 taxonomy + structural sentinel | 130/130 pass |
| `npm run test:layers` | clean (0 unclassified / 0 conflicting; 837 classified) |
| `git diff --check` | clean |
| Forbidden runtime capability grep | none found |
| GitHub CI exact-head (PR #4090) | **all checks pass** (incl. `verify-static`) |

---

## 7. Source Boundary Compliance

- **New files only.** No existing authority was edited.
- **No capability surface.** `grep` confirms no `fetch` / `XMLHttpRequest` /
  `WebSocket` / `process.env` / `pg` / `fs` / `child_process` / `setTimeout` /
  `setInterval` / SQL DDL / `postgres://` / `neon.tech` in the core source.
- **No retry authority copied from #4059.** The #4080 classifier is consumed by
  value through an injected seam only.
- **#4080 stage vocabulary consumed, not redefined.** `REQUEST_ACCEPTED`,
  `DB_TRANSACTION_COMMITTED`, `CANONICAL_ROW_RETURNED`, `FOLLOWUP_REREAD_VISIBLE`,
  `CLIENT_VISIBLE_SUCCESS` are referenced by value via the injected classifier.
- **Privacy fail-closed.** Public output carries only `stage`, `outcome_code`,
  `owner_action`, `visibility`, `browse_eligible`, `synthetic_exclusion` — all
  bounded, frozen, and free of private keys.

---

## 8. Open Items / Web CTO Review Gate

- `READY=NO`, `MERGE=NO`. This Draft PR awaits independent Web CTO exact-head review.
- Issues #4081, #3461, #1882 remain **OPEN** (no closure).
- Production mutation: **none**. No live auth/Neon/Modal/network/DB/credential used.
- If Web CTO confirms, proceed to squash-merge to `main` per governance.

---

Refs #4081.
Refs #3461 — Keep OPEN.
Refs #3835.
Refs #3852.
Refs #3855.
Refs #4079.
Refs #4080.
Refs #1882 — Keep OPEN.
