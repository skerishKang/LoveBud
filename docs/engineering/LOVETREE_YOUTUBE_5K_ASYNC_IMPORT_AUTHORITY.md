# LoveTree YouTube 5K Async Import Authority

**Issue:** #4027  
**Parent Epic:** #4024  
**Product parent:** #3897 — Keep OPEN  
**Platform authority:** #4004  
**Inputs:** #539 async bulk-import design, #4025 OAuth authority, #4026 domain/order/provenance authority  
**Status:** Implementation-ready job contract; no queue/worker/schema implementation in this document.  
**Audited baseline:** LoveBud `main` `ba7d470385f8bf21471cb8d5eeb9a4846df7232d`  
**Last updated:** 2026-08-14

---

## 1. Decision

A playlist snapshot import is a **durable asynchronous job**.

The browser never performs one ordinary Moment write per playlist item, and an HTTP request never waits for all 5,000 Moments to be created.

Target flow:

```text
authenticated owner
→ select authorized YouTube playlist
→ POST import request with idempotency key
→ create private/staged target Tree + durable import job
→ 202 Accepted
→ background executor enumerates provider pages
→ bounded canonical write chunks
→ durable progress/checkpoints
→ completed | partial_failed | failed | cancelled
→ canonical ordered reread
```

Architectural ceiling:

```text
5,000 Moment occurrences / one Tree
```

Rollout gates remain:

```text
300 → 1,000 → 5,000
```

---

## 2. Runtime ownership under #4004

Canonical job state, Tree/Moment state and write rules belong to the **shared platform backend + canonical Neon**.

#4004 explicitly retains Modal for batch/background compute while removing it from the ordinary CRUD critical path.

Therefore this authority is executor-neutral:

```text
love-platform-api / shared backend
= authentication / authorization
= job creation + state authority
= canonical business/write contract
= canonical Neon

background executor
= bounded provider enumeration / normalization / orchestration
= may be Modal or another approved worker runtime
```

If Modal is the first executor, it must not become a second independent product data authority. Canonical persistence must follow the shared job/write contract.

The exact executor mechanism must be revalidated immediately before implementation against current #4004 progress.

---

## 3. Candidate API contract

### Submit

```text
POST /api/imports/youtube
```

Authenticated owner request, conceptually:

```json
{
  "providerConnectionId": "opaque-owned-connection-ref",
  "playlistRef": "opaque-selected-playlist-ref",
  "idempotencyKey": "client-generated-high-entropy-key"
}
```

Server validates:

- authenticated app actor;
- provider connection belongs to actor and is active;
- playlist ref belongs to that connection or can be verified under it;
- source is eligible for snapshot import;
- idempotency key shape/length;
- actor is below concurrent-job limits;
- feature/scale gate permits the source size if known.

Successful acceptance:

```text
HTTP 202
```

Conceptual response:

```json
{
  "ok": true,
  "job": {
    "id": "opaque-job-id",
    "status": "queued",
    "treeId": "opaque-tree-id",
    "expectedCount": 5000,
    "processedCount": 0,
    "succeededCount": 0,
    "failedCount": 0
  }
}
```

`202` means accepted, not imported.

### Status

```text
GET /api/imports/{jobId}
```

Owner-only. Return category/count/progress state, never raw private source payloads or credentials.

### Cancel

```text
POST /api/imports/{jobId}/cancel
```

Owner-only. Cancellation is cooperative and becomes durable `cancel_requested`; executor observes it between bounded provider/write units.

A later resume/retry operation may be added after the state contract is implemented. It must not create duplicates.

---

## 4. Job states

Authoritative top-level states:

```text
queued
processing
completed
partial_failed
failed
cancelled
```

Optional internal/transitional states may exist, but public status must map to these categories without ambiguity.

### queued

Accepted durably; no claim that Moments exist yet.

### processing

Executor owns a valid lease and is processing bounded units.

### completed

All provider-enumerated eligible occurrences have a terminal successful/accepted representation and completeness checks converge.

### partial_failed

Meaningful subset succeeded, but one or more occurrences/provider pages could not be completed under the retry budget. The target remains private/staged and status must not be presented as complete.

### failed

Job cannot make meaningful progress or failed before a valid complete snapshot can be represented.

### cancelled

Owner cancellation was observed and processing stopped at a safe boundary.

Cancellation is not rollback-by-default.

---

## 5. Target Tree lifecycle

Create a target Tree at job acceptance or immediately after durable job creation so the owner can see progress.

Required state:

```text
visibility = private
import lifecycle = importing/staged
```

Exact lifecycle field belongs to canonical schema work.

Rules:

- no Browse/search/public eligibility while queued/processing/partial_failed/failed/cancelled;
- partial Moments may be owner-visible in an explicit import-progress context;
- import completion changes import lifecycle, not publication visibility;
- `completed` does **not** make the Tree public;
- automatic deletion of a failed/cancelled Tree is prohibited by default because it can destroy recoverable state/evidence;
- owner may explicitly delete or retry/resume according to later UI/API.

---

## 6. Durable job model

Candidate `import_jobs` logical fields:

```text
id
actor_id
provider = youtube
provider_connection_id
provider_credential_generation_at_admission nullable
source_collection_ref
source_snapshot_ref
idempotency_key
request_fingerprint
target_tree_id
status
expected_count nullable
discovered_count
processed_count
succeeded_count
failed_count
cancel_requested
executor_lease_id nullable
executor_lease_expires_at nullable
provider_checkpoint nullable
attempt_count
last_error_category nullable
created_at
started_at nullable
updated_at
completed_at nullable
```

Candidate `import_job_items` logical fields:

```text
job_id
source_occurrence_key
external_item_ref nullable
external_media_ref nullable
source_position nullable
normalized_position nullable
status
moment_id nullable
attempt_count
last_error_category nullable
created_at
updated_at
```

Raw private playlist titles/descriptions and OAuth credentials do not belong in job status tables merely for observability.

The job must record the provider connection/credential authority generation under which it was admitted (`provider_credential_generation_at_admission`, or transactionally equivalent opaque server authority). On resume, executor takeover and before provider-authorized work, that admitted generation is revalidated against the current canonical provider connection. A superseded generation is never used silently: the job either server-validates a same-identity rebind to the current generation or stops/fails/requeues with a bounded reauthorization category. Provider credential authority is independent of executor fencing (see the fencing/snapshot addendum §12).

---

## 7. Idempotency authority

### Request level

Required unique scope:

```text
(actor_id, operation='youtube_playlist_import', idempotency_key)
```

Store a normalized request fingerprint.

Rules:

```text
same key + same fingerprint
→ return existing job/result

same key + different fingerprint
→ 409 idempotency conflict
```

Do not create a second Tree.

### Item level

Within one job:

```text
(job_id, source_occurrence_key) unique
```

Prefer provider playlist-item ID when present. Fallback occurrence identity must preserve duplicate video occurrences and follow #4026.

Retry/replay of a provider page cannot create a second Moment for the same job occurrence.

### Intentional re-import

“Import this playlist again as a new Tree” requires a new explicit import request + new idempotency key/job.

Do not block that product action with a global playlist-ID uniqueness constraint.

---

## 8. Provider enumeration

YouTube `playlistItems.list` supports bounded pages, with up to 50 items per page.

Recommended first execution unit:

```text
one provider page <= 50 occurrences
```

For a 5,000-item playlist, full enumeration may require about 100 provider pages.

Do not fetch all pages into one in-memory array before persistence.

Per page:

```text
fetch
→ normalize occurrences
→ durable item/upsert checkpoint
→ bounded canonical Moment persistence
→ update counts/checkpoint
→ check cancellation
→ next page
```

---

## 9. Checkpoint and resume behavior

Persist enough checkpoint state to resume without relying on process memory.

Candidate provider checkpoint may include an opaque next-page token, but page tokens are not the sole correctness authority.

If a stored provider token becomes invalid:

```text
restart enumeration from the beginning
→ item-level idempotency skips already-processed source occurrences
```

This may spend additional provider quota but preserves correctness.

Never “resume from source position N+1” by assuming provider ordering has not changed unless the snapshot/continuity contract proves it.

If the source changes materially during a long snapshot, the job must detect inconsistency where possible and end `partial_failed`/`failed` rather than silently combine two incompatible snapshots.

---

## 10. Bounded persistence chunks

Persistence chunk size is configurable and measured.

Initial benchmark candidate:

```text
25–100 Moments per transaction
```

A natural first candidate is provider-page-sized chunks (<= 50), but the implementation must benchmark canonical Neon/Hyperdrive/shared-API behavior before locking it.

Hard rules:

- not one transaction for 5,000 Moments;
- not 5,000 independent browser-triggered transactions;
- each chunk is atomic for the occurrences it claims successful;
- `sort_order` / source provenance are persisted in the same logical transaction as the Moment occurrence where possible;
- counters advance from committed item outcomes, not optimistic in-memory guesses.

---

## 11. Executor lease / duplicate worker protection

A job can have at most one active processing lease.

Required concepts:

```text
lease owner/token
lease expiry
atomic claim/renew
```

If an executor dies:

- lease expires;
- another executor may claim;
- item idempotency prevents duplicate Moments;
- persisted counts/checkpoint drive resumption.

Do not rely on “only one Modal container should happen to run this.”

---

## 12. Retry policy

Classify before retry.

### Transient provider failures

Examples: timeout, selected 5xx, rate-limit/retryable provider response.

Use bounded exponential backoff + jitter with a small retry budget per operation/page.

Recommended design target:

```text
<= 3 automatic retries per provider page/operation
```

Exact timings are implementation/config scope.

### Auth failures

On access-token expiry:

- refresh once through the provider connection authority;
- retry the failed authorized request once after successful refresh.

On revoked/invalid refresh credential:

```text
connection → reauth_required
job → partial_failed or failed with safe auth category
```

Do not retry revoked credentials in a loop.

### Validation/permanent item failures

Do not retry malformed/permanently unavailable item states as transport failures. Normalize them through #4026/#4029 policy.

### Database operational failures

Use the shared platform's reviewed transaction/retry policy. Never retry a non-idempotent chunk outside its idempotency boundary.

---

## 13. Counters and completeness

Track separately:

```text
expected_count
= provider collection metadata count when available; advisory until enumeration converges

discovered_count
= source occurrences durably observed

processed_count
= source occurrences with a terminal item processing result

succeeded_count
= occurrences represented successfully under the domain policy

failed_count
= occurrences with terminal failed processing
```

Completion requires internal reconciliation.

Examples:

```text
processed_count = succeeded_count + failed_count
```

and provider enumeration must have a terminal “no next page” condition.

If provider says 5,000 but only 4,950 can be accounted for and there is no authorized explanation, do not report complete.

No hidden cap.

---

## 14. Cancellation

Cancellation is cooperative.

Server:

```text
cancel_requested = true
```

Executor checks before/after each bounded provider page/write chunk.

A transaction already committing may complete; cancellation stops subsequent units.

Final state:

```text
cancelled
```

Partial target Tree/Moments remain private/staged.

No automatic public visibility and no automatic destructive rollback.

A future “discard imported Tree” is an explicit owner deletion action.

---

## 15. Concurrency limits

Do not allow one actor to launch unbounded simultaneous 5K jobs.

Initial policy should be conservative, e.g. one active large YouTube import per actor, with a small global/provider-aware executor limit.

Exact limits belong to configuration and 300/1K/5K load evidence.

Queued additional jobs may be allowed only if quota/resource behavior is understood.

---

## 16. Scale gates

### Gate A — 300

Must prove:

- exact count/order/provenance;
- idempotent replay;
- cancellation;
- executor restart/resume;
- owner-only progress;
- no public leakage.

### Gate B — 1,000

Additionally prove:

- bounded memory/transaction behavior;
- provider pagination/checkpoint restart;
- large-read integration with #4028;
- `lovetree-limone` large UI compatibility.

### Gate C — 5,000

Additionally prove:

- full count reconciliation;
- no timeout-based architecture dependency;
- bounded executor memory;
- acceptable provider quota behavior;
- no duplicate/gap under restart;
- 5K UI acceptance under #4031 / `lovetree-limone#172`.

No Gate C Production mutation solely for test evidence without explicit approval.

---

## 17. Observability/redaction

Allowed category-level telemetry:

```text
job state
count bucket
processed/succeeded/failed counts
provider operation category
retry count bucket
latency bucket
executor/runtime category
error category
```

Prohibited in ordinary logs/telemetry:

- OAuth access/refresh tokens;
- authorization codes;
- API/client secrets;
- raw private playlist URL/ID/title;
- raw private playlist item titles/descriptions;
- private Moment memo/content;
- raw provider error body;
- database connection secrets.

Job IDs and Tree IDs should be treated as internal identifiers and omitted/redacted from externally shared reports unless necessary.

---

## 18. API error categories

Candidate submit/status categories:

```text
IMPORT_ALREADY_ACTIVE
IMPORT_IDEMPOTENCY_CONFLICT
IMPORT_NOT_FOUND
IMPORT_FORBIDDEN
IMPORT_PROVIDER_REAUTH_REQUIRED
IMPORT_PROVIDER_LIMITED
IMPORT_SOURCE_CHANGED
IMPORT_PARTIAL_FAILURE
IMPORT_CONFIGURATION_REQUIRED
IMPORT_INTERNAL_FAILURE
```

Browser messaging should be recovery-oriented, not raw provider/DB text.

---

## 19. Security/access matrix

| Operation | Actor |
|---|---|
| create import job | authenticated owner of provider connection |
| read job status | same app actor / authorized admin only |
| cancel job | same app actor |
| claim/advance job | trusted executor only |
| write item outcome | trusted canonical job/write authority only |
| read encrypted provider credential | server provider-auth boundary only |
| publish target Tree | separate owner publication flow; never import worker |

Executor identity must not be a user-controlled header.

---

## 20. Required implementation tests

1. submit returns 202 quickly;
2. same idempotency key/request returns same job/tree;
3. same key/different request returns conflict;
4. duplicate executor claim rejected or lease-safe;
5. provider-page replay creates no duplicate Moments;
6. executor crash after commit resumes without duplicate/gap;
7. executor crash before commit safely retries chunk;
8. expired provider access token refreshes once;
9. revoked provider credential stops with safe state;
10. cancellation stops after bounded unit;
11. partial/cancelled Tree stays private;
12. queued/processing never reported completed;
13. counters reconcile;
14. provider count mismatch cannot become successful complete state;
15. 300, 1K, 5K controlled fixtures pass count/order/idempotency gates;
16. logs contain no private source/credential payload;
17. actor B cannot read/cancel actor A job;
18. semantic Connections created by import = 0.

---

## 21. Non-goals

- no queue/worker implementation in this authority PR;
- no one-shot 5K endpoint;
- no 5K browser write loop;
- no automatic publication;
- no automatic source sync;
- no AI semantic processing in import critical path;
- no independent `lovetree-limone` job database;
- no unbounded retry;
- no correctness that depends solely on an opaque provider page token.

---

## 22. Implementation split

After authority approval:

1. canonical import job/item schema + indexes/migration under #4004;
2. job submit/status/cancel API contract;
3. executor claim/lease mechanism;
4. YouTube paginated enumerator integrated with #4025;
5. bounded canonical Moment/provenance writer integrated with #4026;
6. retry/resume/cancellation hardening;
7. 300 gate;
8. #4028 read integration + 1K gate;
9. #4031 / `lovetree-limone#172` integration + 5K gate.

---

## 23. Authority verdict

```text
IMPORT_EXECUTION_MODEL = DURABLE_ASYNC_JOB
5K_BROWSER_WRITE_LOOP = PROHIBITED
5K_SINGLE_TRANSACTION = PROHIBITED
IDEMPOTENCY = REQUEST + ITEM LEVEL
JOB_LEASE = REQUIRED
RESUME = DURABLE_CHECKPOINT + ITEM IDEMPOTENCY
AUTO_PUBLISH = PROHIBITED
INCOMPLETE_TREE_PUBLIC_ELIGIBILITY = PROHIBITED
SCALE_GATES = 300 → 1000 → 5000
CANONICAL_JOB_DATA_AUTHORITY = SHARED_PLATFORM / CANONICAL_NEON
BACKGROUND_EXECUTOR = PLUGGABLE; REVALIDATE #4004 BEFORE IMPLEMENTATION
RUNTIME_IMPLEMENTATION = NOT_YET_PERFORMED
```
