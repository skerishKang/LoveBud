# Async Import Worker and Queue Mechanism Design

Issue: #563
Related design: #539, #560
Related contracts: #561, #562

This document defines a planning-only worker and queue mechanism direction for future async import jobs. It does not implement a worker, queue, runtime route, database migration, UI, package change, workflow change, deployment change, or production data mutation.

## Purpose

Async bulk imports need a safe execution mechanism after a request is accepted. The system must be able to claim queued jobs, process bounded chunks, record progress, retry safely, and stop without corrupting state or duplicating target records.

This document narrows the worker/queue design space for the active LoveBud runtime posture:

```text
Browser -> same-origin /api/* -> Cloudflare Pages Functions -> Modal -> Neon
```

## Non-goals

- No worker or queue implementation.
- No production queue creation.
- No production data mutation.
- No database migration.
- No runtime API route implementation.
- No UI or progress screen implementation.
- No Browse/Search cache behavior change.
- No Editor/Auth/My Trees changes.
- No package, workflow, deployment, or infrastructure changes.
- No PR #7/prototype/reference/demo/variant changes.
- No PR #450 changes.
- No secret/token/session/cookie/API key/private payload output.

## Design constraints

A future worker mechanism must satisfy these constraints:

- avoid long synchronous HTTP request processing;
- process jobs in bounded chunks;
- preserve idempotency across retries;
- avoid duplicate target records;
- keep database connection usage bounded;
- expose progress through durable job and item status;
- isolate authorization/visibility decisions from worker internals;
- support safe failure and recovery;
- avoid private payload exposure in logs and reports.

## Candidate mechanism options

### Option A — Modal scheduled or invoked worker

A Modal function could periodically or explicitly claim queued jobs and process chunks.

Potential advantages:
- aligns with current active backend runtime;
- can use backend credentials without exposing them to the browser;
- can keep heavy processing outside Cloudflare request duration;
- can reuse existing Python/backend testing patterns if approved.

Risks and questions:
- exact trigger mechanism must be defined;
- concurrency must be capped;
- worker ownership and deployment cadence must be clear;
- retry behavior must not conflict with job claiming;
- runtime owner approval is required before implementation.

### Option B — Database-backed polling queue

Jobs are stored in durable tables and workers poll for queued jobs.

Potential advantages:
- simple conceptual model;
- job state and queue state live in one durable system;
- easy to inspect category-level job state.

Risks and questions:
- polling interval and query load must be bounded;
- job claiming must be atomic;
- stale processing jobs require recovery rules;
- indexes must be validated before production;
- migration and rollback planning are required.

### Option C — External queue service

A future implementation could use a dedicated queue service.

Potential advantages:
- native queue semantics;
- better scaling and retry features if chosen carefully.

Risks and questions:
- new infrastructure increases operational surface area;
- package/workflow/deployment changes may be required;
- ownership, credentials, and cost must be approved;
- queue payload must not store private raw content unnecessarily.

## Recommended initial direction

The safest first implementation direction is a database-backed job table with a narrowly scoped Modal worker design, but only after #561 storage and #562 API contracts are accepted.

This keeps the first implementation aligned with the current Cloudflare Pages Functions -> Modal -> Neon runtime while avoiding a new external queue dependency until product and operations justify it.

This recommendation does not authorize implementation. It only defines the preferred design direction for future planning.

## Job claiming contract

A future worker must claim jobs atomically. The claim operation should satisfy:

- only `queued` jobs are claimable by default;
- one worker should claim a job or chunk at a time;
- claim timestamp and attempt metadata should be recorded;
- stale `processing` jobs must have an explicit recovery rule;
- a job must not be claimed if it is terminal: `completed`, `partial_failed`, `failed`, or `cancelled`.

Candidate state transition:

```text
queued -> processing -> completed
queued -> processing -> partial_failed
queued -> processing -> failed
queued -> cancelled
processing -> cancelled
processing -> queued/retry_pending, only if a stale-claim recovery policy is approved
```

## Chunk processing contract

A future worker must process bounded chunks. The implementation must define:

- max items per chunk;
- max chunks per worker invocation;
- max worker runtime per invocation;
- max concurrent jobs;
- max concurrent chunks per job;
- transaction boundaries;
- whether chunk completion is all-or-itemized;
- how item failures affect job status.

Recommended default posture:

- process item outcomes individually;
- update job counters after each chunk;
- avoid one transaction spanning an entire large import;
- never mark a job `completed` until all valid items are terminal and counts are consistent.

## Retry and backoff contract

A future worker must define retry behavior before implementation:

- job-level retry budget;
- item-level retry budget;
- retryable vs non-retryable error categories;
- exponential or fixed backoff behavior;
- stale claim timeout;
- maximum total job age;
- terminal failure conditions.

Retries must update existing job and item rows. They must not create duplicate jobs or duplicate target records.

## Failure handling

Failure handling must be category-level and sanitized.

Recommended categories:

| Category | Meaning |
| --- | --- |
| `validation_failed` | Item or request cannot be processed as submitted. |
| `authorization_failed` | Caller or owner boundary fails. |
| `target_conflict` | Item maps to an existing target or violates uniqueness. |
| `transient_backend_error` | Temporary backend or database failure. |
| `worker_interrupted` | Worker stopped before finishing a chunk. |
| `unknown_error` | Generic sanitized fallback. |

Reports must not include raw imported content, credentials, owner identifiers, tokens, cookies, sessions, API keys, or private target details.

## Concurrency limits

A future implementation must define conservative limits before rollout:

- maximum queued jobs per creator/admin;
- maximum active jobs globally;
- maximum active jobs per creator/admin;
- maximum chunk size;
- maximum database connections per worker;
- maximum worker invocations per time window;
- maximum retry attempts per item and job.

Any limit increase requires staging verification and runtime owner approval.

## Pause, resume, and cancel semantics

Pause/resume/cancel behavior is optional and should not be implemented implicitly.

If implemented:

- `cancelled` must be terminal unless a separate requeue action is explicitly designed;
- cancellation must not leave partially created target records without category-level reporting;
- paused jobs must not be claimed by normal workers;
- resume must preserve idempotency and continue from durable item state.

If not implemented, API and UI contracts must not imply pause/resume/cancel support.

## Database safety requirements

Before any implementation, owners must define:

- required indexes for job claiming and item lookup;
- locking or atomic-update strategy;
- transaction size limits;
- retention and cleanup policy;
- stale `processing` recovery policy;
- rollback strategy for abandoned worker deployments;
- staging verification with bounded test data.

Production bulk mutation is not allowed without an explicit rollout and rollback plan.

## Verification requirements for future implementation

A future implementation PR must verify:

- one worker can claim a queued job atomically;
- two workers cannot process the same chunk concurrently;
- chunk size limits are enforced;
- job counters remain consistent after success, failure, retry, and interruption;
- retry does not create duplicate targets;
- stale processing recovery behaves as designed;
- terminal states are not reprocessed;
- logs and reports expose no private payloads or credentials;
- staging and rollback plan exists before production mutation.

## Relationship to follow-up issues

- #561 defines durable job and item storage fields.
- #562 defines accepted/status API semantics.
- #564 should decide whether job progress appears in UI.
- #565 should define staging, rollback, and production rollout gates.

## Closure criteria for #563

#563 can close when the worker/queue mechanism design is documented and implementation remains either explicitly deferred or split into separately approved implementation issues.

This document satisfies only the planning contract. It does not authorize worker deployment, queue creation, production data mutation, or database migration.
