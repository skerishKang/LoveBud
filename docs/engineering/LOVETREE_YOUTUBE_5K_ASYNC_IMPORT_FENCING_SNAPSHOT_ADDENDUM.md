# LoveTree YouTube 5K Async Import — Fencing / Snapshot Coherence Addendum

**Issue:** #4027  
**Parent Epic:** #4024  
**Product parent:** #3897 — Keep OPEN  
**Platform authority:** #4004  
**Base authority:** `LOVETREE_YOUTUBE_5K_ASYNC_IMPORT_AUTHORITY.md`  
**Domain authority:** #4026  
**QA authority:** #4031  
**Status:** Normative future implementation addendum. No queue/worker/schema/provider/Production/Preview implementation is authorized here.

---

## 1. Purpose

The base async authority correctly selected durable jobs, bounded provider pages, bounded DB chunks, request/item idempotency, checkpoint/resume, one active executor lease, truthful terminal states, and 300→1K→5K staged validation.

Two distributed-correctness requirements are mandatory before runtime implementation:

1. **lease ownership must be fenced at every authoritative mutation**, not only at claim time;
2. **provider page-token traversal must not be treated as source snapshot isolation**.

This addendum is normative for both requirements.

---

## 2. Executor fencing generation

Every successful executor claim/takeover must advance a server/database-controlled monotonic fencing generation or transactionally equivalent authority.

Conceptual field:

```text
executor_fence_epoch
```

Exact schema name is not fixed.

Required lifecycle:

```text
job unclaimed
→ worker A claims
→ epoch = 1

lease expires
→ worker B claims/takes over
→ epoch = 2

worker A later resumes with epoch = 1
→ authoritative mutation = 0
→ A stops/reloads
```

A lease owner token plus expiry is not sufficient unless every authoritative write proves current ownership/fencing authority.

---

## 3. Every authoritative executor mutation is fenced

At minimum the current fence/generation must be checked inside the same authoritative transaction for:

- item outcome persistence;
- occurrence/member finalization decisions;
- provider checkpoint/page-token advance;
- source-enumeration fingerprint/digest state;
- processed/succeeded/failed/skipped counters;
- lease renewal;
- heartbeat/progress timestamps that affect ownership or recovery;
- cancellation acknowledgement;
- processing state transition;
- `completed` transition;
- `partial_failed` transition;
- `failed` transition;
- `cancelled` transition.

Conceptually:

```sql
UPDATE import_job
SET ...
WHERE id = :job_id
  AND executor_fence_epoch = :held_epoch
  AND current lease authority is still valid
```

or a transactionally equivalent reviewed mechanism.

If the fence predicate fails:

```text
MUTATION = 0
STOP/RELOAD = REQUIRED
BLIND_RENEW = FORBIDDEN
```

---

## 4. Item idempotency is a separate guarantee

Item/occurrence idempotency protects canonical data from duplicate logical effects.

It does **not** protect:

- checkpoints;
- counters;
- cancel state;
- source fingerprint state;
- job error state;
- terminal job status.

Therefore:

```text
ITEM_IDEMPOTENCY != EXECUTOR_FENCING
```

Both are required.

---

## 5. Terminal-state fencing

Terminal states must be monotonic/fenced under current ownership authority.

A stale worker must never overwrite a state written by the current executor, for example:

```text
worker B → cancelled
worker A stale resume → completed   # FORBIDDEN
```

or:

```text
worker B → failed/partial_failed
worker A stale resume → processing  # FORBIDDEN
```

Cancellation observation must use the same authoritative fence so a stale process cannot clear, ignore, or race past cancellation.

---

## 6. Provider page tokens are not snapshot authority

A provider traversal such as:

```text
page 1
→ nextPageToken
→ page 2
→ ...
→ page N
```

is a bounded pagination mechanism. It must not be treated as proof that all pages represent one immutable source playlist version.

For a long 300/1K/5K enumeration, source membership/order may change while traversal is running.

Failure example:

```text
pages 1..40 read
→ playlist owner removes item A and inserts item Z
→ total count remains unchanged
→ pages 41..100 read
```

Count equality and item idempotency alone cannot prove a coherent snapshot.

---

## 7. Canonical source-enumeration coherence evidence

The server must maintain bounded evidence sufficient to prove final **membership + order + count** coherence for the enumeration it is about to call complete.

Required evidence conceptually includes:

```text
normalized occurrence identity
+ normalized source position/order
→ deterministic server-side fingerprint/digest
```

The exact occurrence identity follows #4026 and must preserve repeated-video occurrences rather than collapsing by underlying video ID.

The digest/fingerprint must not be logged with raw private playlist titles/content. Only bounded non-secret hash/version evidence may be persisted/logged under the selected privacy contract.

`source_snapshot_ref` is valid authority only if it corresponds to verifiable/server-verifiable coherence evidence; a timestamp or arbitrary label alone is insufficient.

---

## 8. Selected bounded coherence strategy

Future implementation must use a **bounded terminal revalidation protocol** or a provider-supported equivalent that proves the same invariants.

Default planning direction:

```text
PASS 1
bounded full enumeration
→ persist occurrence identity/order under job staging authority
→ compute membership+order fingerprint

TERMINAL REVALIDATION
bounded re-enumeration or equivalent authoritative verification
→ compute fresh membership+order fingerprint
→ compare count + membership + order fingerprint
```

If the provider later exposes a stronger documented immutable revision primitive, the implementation may substitute it after explicit review. Page-token continuity alone is not such a primitive.

For 5K, a bounded second pass is operationally more expensive but correctness-preserving; actual quota/cost viability must be measured before Product activation.

---

## 9. Drift handling

If terminal revalidation detects membership/order/count drift:

```text
job MUST NOT transition to completed
```

Allowed future outcomes under bounded policy:

```text
A. discard/reconcile abandoned staging snapshot
   → restart clean enumeration
   → bounded retry budget

or

B. transition partial_failed / failed
   → explicit source_changed category
   → owner can retry
```

What is forbidden:

- marking a mixed-version occurrence set `completed`;
- relying on expected_count only;
- silently retaining rows from an abandoned source version as final membership;
- endlessly restarting without a bounded retry budget.

---

## 10. Staging membership replacement/reconciliation

Restart after detected source drift must have explicit authority for prior staged occurrence rows.

The implementation must use one of:

```text
job-version-scoped staging membership
or
transactionally replaced/reconciled occurrence membership
or
equivalent canonical authority
```

so that abandoned version-1 rows cannot remain silently counted as version-2 final snapshot membership.

Canonical published LoveTree/Moment state is governed separately by #4026/#4029; an incomplete async job must not expose staging state publicly.

---

## 11. Checkpoint/resume interaction

A provider checkpoint is only an execution-resume hint within the current fenced job enumeration generation.

It is not durable proof that prior pages remain part of the same provider snapshot after long delay/takeover.

Therefore after material events such as:

- executor takeover;
- long lease gap;
- bounded retry after provider instability;
- source-drift detection;
- implementation-selected maximum snapshot age exceeded;

the worker must follow the selected source-coherence/restart policy rather than blindly continuing a stale page token chain.

---

## 12. Required controlled tests

Future runtime implementation must include executable deterministic tests for at least:

### Fencing

1. worker A claims epoch 1;
2. A lease expires;
3. worker B claims epoch 2;
4. A resumes and attempts checkpoint mutation → zero rows/zero authoritative mutation;
5. A attempts counter mutation → zero;
6. A attempts item-outcome mutation → zero;
7. A attempts terminal state mutation → zero;
8. B alone can advance checkpoint/counters/items/status;
9. stale A cannot renew old authority;
10. cancellation written/observed by current executor cannot be overwritten by stale executor.

### Snapshot coherence

11. membership remove+insert mid-enumeration with same total count → never `completed` mixed snapshot;
12. reorder mid-enumeration with same membership/count → never `completed` mixed order;
13. membership count change → detected;
14. stable source across pass/revalidation → completion permitted;
15. drift retry uses bounded budget;
16. abandoned staging membership cannot remain in final snapshot silently;
17. repeated-video occurrences remain distinct according to #4026 occurrence identity;
18. raw private playlist content is absent from diagnostic logs/fingerprint telemetry.

Cross-repository 300/1K/5K E2E is coordinated with #4031.

---

## 13. Reconciled async verdict

```text
DURABLE_ASYNC_JOB = REQUIRED
REQUEST_IDEMPOTENCY = REQUIRED
ITEM_OCCURRENCE_IDEMPOTENCY = REQUIRED
EXECUTOR_LEASE = REQUIRED
EXECUTOR_FENCE_GENERATION = REQUIRED
EVERY_AUTHORITATIVE_WRITE_FENCED = REQUIRED
STALE_EXECUTOR_AUTHORITATIVE_MUTATION = ZERO
PAGETOKEN_AS_SNAPSHOT_ISOLATION = FORBIDDEN
SOURCE_COHERENCE = MEMBERSHIP_PLUS_ORDER_PLUS_COUNT
TERMINAL_SOURCE_REVALIDATION = REQUIRED_OR_STRONGER_PROVEN_EQUIVALENT
MIXED_SOURCE_VERSION_COMPLETION = FORBIDDEN
DRIFT_RETRY = BOUNDED
RUNTIME_IMPLEMENTATION = NOT_YET_PERFORMED
```

This is future planning only. It authorizes no queue/worker runtime, schema migration, provider request, Production/Preview mutation, DB bulk import, or second LoveTree backend authority.

Refs #4026.  
Refs #4027.  
Refs #4031.  
Refs #4024.  
Refs #4004.  
Refs #3897 — Keep OPEN.  
Refs #1882 — Keep OPEN; use only `Refs #1882`.
