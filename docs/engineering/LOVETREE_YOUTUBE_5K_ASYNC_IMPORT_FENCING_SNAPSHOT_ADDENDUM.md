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

## 12. Provider credential authority generation reconciliation

This section reconciles the base async authority with the current #4025 OAuth reconnect / credential-generation authority. It is normative for future implementation planning. **Executor fencing and provider credential authority are two independent domains and must remain distinct.**

### 12.1 Two fencing domains

A. **Executor fencing** — `executor_fence_epoch` (or transactionally equivalent authority).
Purpose: which worker/executor is currently allowed to mutate authoritative import job state.
Protects: item outcome write, checkpoint advance, counters, lease renew, cancel acknowledgement, processing status, terminal status.

B. **Provider credential authority** — `provider_credential_generation` / `provider_connection_revision` (or transactionally equivalent opaque server authority).
Purpose: which canonical provider credential authority the job is allowed to use for provider-authorized work.
Protects: playlist enumeration, provider page request, provider metadata request, token refresh/use, resume provider work, takeover provider work.

Required invariant:

```text
EXECUTOR_FENCE_EPOCH != PROVIDER_CREDENTIAL_GENERATION
```

A current executor may still hold a stale provider credential. A current provider credential does not make a stale executor authoritative. Both must independently pass before their respective work proceeds.

### 12.2 Job admission binding

Future conceptual `import_jobs` authority adds an admitted-generation binding:

```text
provider_connection_id
provider_credential_generation_at_admission
```

(or equivalent opaque authority reference; exact schema names are not fixed).

Job admission must resolve server-side:

```text
actor → canonical provider connection → current verified connection authority → current credential generation → bind job admission to that generation
```

Browser/client must not mint `provider_connection_id` authority, `credential_generation`, or `connection_revision` arbitrarily. Client-supplied generation must never be trusted as authority.

### 12.3 Provider-authorized work gate

Revalidate provider authority before provider-authorized work at minimum at:

- initial worker start;
- resume after process restart;
- executor lease takeover;
- before beginning a new provider page batch;
- after token refresh / reconnect signal;
- before retry after provider authorization failure.

This is bounded server-side validation — not a wasteful provider identity call before every individual API request. Required validation before continuing provider-authorized work:

```text
current canonical provider connection
+ active status
+ expected provider identity
+ credential generation compatibility
```

### 12.4 Rotation / reconnect transition matrix

C1 — **unchanged credential authority**: job admitted under generation N, current canonical connection generation = N → provider work may proceed, subject to executor fence and all normal auth checks.

C2 — **reconnect without new refresh_token**: per #4025, an existing usable encrypted refresh credential is preserved. Do not assume `credential_generation` must advance merely because non-secret connection metadata changed. If canonical credential authority is still generation N, a job admitted under N may continue after bounded server-side validation. If an implementation uses a broader connection revision that advances independently of `credential_generation`, that must not be conflated with credential rotation; document the distinction.

C3 — **same canonical provider identity, new refresh_token returned**: old generation N → atomic credential rotation, current generation N+1. A job admitted under N MUST NOT use the generation N credential. Selected future transition: server validates same actor / same canonical provider identity / canonical connection remains active / new current generation is valid, then the job may **REBIND N → N+1** through an authoritative server-side transition. Rebind must be persisted and race-safe. No browser-supplied generation update.

C4 — **rotation during rebind**: concurrent credential rotation N → N+1 then N+1 → N+2. A job attempting rebind must bind only to the currently validated generation. It must not persist N+1 as current after canonical authority already advanced to N+2. Use compare-and-set / transaction / equivalent future authority semantics.

C5 — **disconnect/revoke**: canonical connection becomes unusable → automatic rebind = **FORBIDDEN**. The job must stop/fail/requeue with a bounded sanitized category such as `PROVIDER_REAUTHORIZATION_REQUIRED` (or equivalent). Disconnect/revoke must never be interpreted as "find a newer generation and continue"; a new verified OAuth flow is required.

C6 — **canonical provider identity changes**: job admitted for identity X, current connection is now identity Y → silent rebind = **FORBIDDEN**. The job must stop/fail/requeue or require explicit new import authority. Never silently convert an import of playlist/account X into provider identity Y.

### 12.5 Rebind authority

If same-identity credential rotation is rebindable, the future server transition is conceptually:

```text
job provider generation = N
current canonical generation = N+1
```

Server proves: job actor == connection actor; provider == youtube; canonical provider identity unchanged; connection active; N is superseded; N+1 is the exact current generation. Then atomically: `job.provider_credential_generation` N → N+1. Provider work may resume only after successful authoritative rebind.

```text
REBIND_WITHOUT_SERVER_VALIDATION = FORBIDDEN
CLIENT_GENERATION_MINTING = FORBIDDEN
REBIND_TO_NONCURRENT_GENERATION = FORBIDDEN
REBIND_AFTER_DISCONNECT = FORBIDDEN
CROSS_IDENTITY_REBIND = FORBIDDEN
```

### 12.6 Executor takeover × credential rotation

Worker A owns executor epoch E1 and job credential generation N → credential rotates N → N+1 → A pauses → lease expires → worker B takes executor epoch E2.

B must independently validate BOTH:

```text
executor authority: E2 current
provider authority: N stale vs canonical N+1
```

B cannot conclude "I own E2, therefore old N is usable." B rebinds to N+1 if same canonical active identity and rebind policy permits, or stops/fails/requeues if provider authority is unusable. When A resumes, A fails executor fence E1 even if it somehow knows N+1.

```text
STALE_EXECUTOR + CURRENT_CREDENTIAL → authoritative mutation forbidden
CURRENT_EXECUTOR + STALE_CREDENTIAL → provider work forbidden
```

### 12.7 Access token vs canonical credential generation

A short-lived access-token refresh using the same canonical refresh credential authority does **not** mean `provider_credential_generation` advances. Credential generation represents long-lived canonical authority replacement/revocation (or a transactionally equivalent event), not every ephemeral access-token issuance.

```text
ACCESS_TOKEN_INSTANCE != CANONICAL_CREDENTIAL_GENERATION
```

Otherwise long 5K imports would spuriously stale themselves on every normal token refresh.

### 12.8 Failure truthfulness

If provider credential authority becomes unusable, the job must never report `completed` merely because canonical DB writes already exist. Use the truthful bounded #4027 lifecycle (`queued` / `processing` / `partial_failed` / `failed` / `cancelled`) with a bounded error/reason category kept separately. Conceptual categories: `PROVIDER_REAUTHORIZATION_REQUIRED`, `PROVIDER_AUTHORITY_SUPERSEDED`, `PROVIDER_IDENTITY_CHANGED` — exact public vocabulary remains future implementation detail unless #4027 already fixes it. No raw OAuth/provider response body in error evidence.

### 12.9 Snapshot coherence survives rebind

Credential rebind does not reset or bypass source snapshot coherence. Example: pages 1–40 enumerated under generation N, credential rotates, job rebinds to N+1, pages 41–100 continue. Same provider identity does not prove the source snapshot is unchanged. Completion still requires membership + order + count coherence and terminal bounded revalidation.

```text
PAGETOKEN_AS_SNAPSHOT_ISOLATION = FORBIDDEN
MIXED_SOURCE_VERSION_COMPLETION = FORBIDDEN
CREDENTIAL_REBIND_BYPASSES_SNAPSHOT_CHECK = NO
```

### 12.10 Model B visibility remains unchanged

During import: Tree private, ALL imported Moments private. Import completion != publication. Provider credential failure/rebind/requeue must never expose incomplete imported content publicly.

```text
INCOMPLETE_IMPORT_PUBLIC_EXPOSURE = ZERO
```

Publication freshness remains owned by #4029/#4036; this section does not modify publication semantics.

---

## 13. Required controlled tests

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

### Provider credential authority

19. CG1 — job admitted under generation N, current generation N → provider work allowed;
20. CG2 — reconnect without new refresh_token; existing usable credential generation remains N → job continues after validation; no forced stale transition;
21. CG3 — new refresh_token rotates N → N+1 → old-N provider use = 0; server-validated same-identity rebind succeeds;
22. CG4 — concurrent rotation N → N+1 → N+2 during rebind → job cannot settle on stale N+1;
23. CG5 — disconnect/revoke after job admission → provider calls after revoke = 0; no automatic generation rebind; truthful fail/requeue/reauthorization requirement;
24. CG6 — provider identity X → Y → cross-identity silent rebind = 0;
25. CG7 — executor takeover after credential rotation → new executor validates/rebinds provider authority before provider work;
26. CG8 — old executor resumes after takeover → authoritative job mutation = 0 regardless of provider generation knowledge;
27. CG9 — normal access-token refresh at the same canonical credential generation → does not unnecessarily stale the job;
28. CG10 — credential rotation mid-enumeration → rebind does not bypass membership/order/count terminal revalidation;
29. CG11 — queued job generation becomes stale before first worker start → first worker resolves current authority before first provider call;
30. CG12 — processing job generation becomes stale → no stale provider request after detection;
31. CG13 — malformed/client-minted credential generation → ignored/rejected/fail closed; cannot grant authority;
32. CG14 — raw refresh/access token, ciphertext, provider account identifier, raw provider response → never logged/emitted in GitHub evidence.

---

## 14. Reconciled async verdict

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
PROVIDER_CREDENTIAL_GENERATION_BINDING = REQUIRED (admitted generation recorded)
JOB_ADMISSION_PROVIDER_AUTHORITY = REQUIRED (server-side canonical resolution)
SILENT_STALE_CREDENTIAL_USE = FORBIDDEN
SAME_IDENTITY_ROTATION_REBIND = SERVER_VALIDATED_ONLY
REBIND_TO_NONCURRENT_GENERATION = FORBIDDEN
REBIND_AFTER_DISCONNECT_REVOKE = FORBIDDEN
CROSS_IDENTITY_REBIND = FORBIDDEN
CLIENT_GENERATION_MINTING = FORBIDDEN
EXECUTOR_FENCE_AND_PROVIDER_GENERATION = DISTINCT
ACCESS_TOKEN_REFRESH = NOT_CANONICAL_CREDENTIAL_GENERATION_ROTATION
CREDENTIAL_REBIND_BYPASSES_SNAPSHOT_CHECK = NO
INCOMPLETE_IMPORT_PUBLIC_EXPOSURE = ZERO
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
