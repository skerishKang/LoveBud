# Async Import Storage Contract

Issue: #561
Related design: #539, #560

This document defines a planning-only durable storage contract for future async import jobs and job items. It does not create a database migration, runtime route, worker, queue, UI, package change, workflow change, or production data mutation.

## Purpose

Future large import requests should be represented as durable jobs with item-level outcomes. Durable storage is needed so the system can report progress, retry safely, recover from worker interruption, and avoid duplicate inserts after client retry.

This document narrows the storage contract expected by the async import design without authorizing implementation.

## Non-goals

- No production database migration.
- No runtime API route implementation.
- No worker or queue implementation.
- No UI or progress screen implementation.
- No Browse/Search cache behavior change.
- No Editor/Auth/My Trees changes.
- No package, workflow, deployment, or infrastructure changes.
- No production bulk mutation test.
- No PR #7/prototype/reference/demo/variant changes.
- No PR #450 changes.
- No secret/token/session/cookie/API key/private payload output.

## Storage entities

The future import system should use two durable entities or equivalent tables:

1. `import_jobs` — one row per submitted import job.
2. `import_job_items` — one row per submitted source item or normalized source item outcome.

The exact physical storage can be decided later, but the contract below defines the required fields and behavior.

## `import_jobs` contract

Recommended fields:

| Field | Purpose | Notes |
| --- | --- | --- |
| `id` | Opaque job identifier | Must not expose sequential internal assumptions to untrusted callers. |
| `status` | Top-level job state | See allowed statuses below. |
| `source_type` | Source category | Example: `numeric_id_batch`; exact values require product/backend approval. |
| `import_type` | Import intent | Must be explicit before implementation. |
| `total_count` | Submitted item count | Count after request shape validation. |
| `processed_count` | Items attempted | Must not exceed `total_count`. |
| `success_count` | Items completed successfully | Must not include skipped or failed items. |
| `failed_count` | Items failed | Must not expose private item contents. |
| `skipped_count` | Items intentionally skipped | Optional but recommended for duplicate or invalid items. |
| `created_by` | Principal that created the job | Exact owner/admin model must be defined before implementation. |
| `created_at` | Job creation timestamp | Required. |
| `started_at` | First processing timestamp | Nullable while queued. |
| `completed_at` | Terminal timestamp | Nullable until terminal state. |
| `error_summary` | Category-level terminal error | Must not contain private payload values. |
| `idempotency_key` | Retry/dedup key | Scope must be defined before implementation. |
| `request_fingerprint` | Optional normalized request digest | Must not store raw private payload if avoidable. |

## Allowed job statuses

| Status | Meaning |
| --- | --- |
| `queued` | Job accepted but not yet processing. |
| `processing` | Worker has started processing chunks. |
| `completed` | All valid items completed successfully. |
| `partial_failed` | At least one item failed while at least one item succeeded or was skipped. |
| `failed` | Job failed before meaningful completion or all items failed. |
| `cancelled` | Job intentionally cancelled, if cancellation is implemented. |

Reports and UI must not treat `queued` or `processing` as imported. Only terminal states may be summarized as finished.

## `import_job_items` contract

Recommended fields:

| Field | Purpose | Notes |
| --- | --- | --- |
| `job_id` | Parent import job | Foreign-key or equivalent reference to `import_jobs`. |
| `source_id` | Submitted source identifier | Must be normalized before uniqueness checks. |
| `source_index` | Original order position | Useful for deterministic reporting without exposing payload details. |
| `status` | Item state | See allowed item statuses below. |
| `attempt_count` | Number of processing attempts | Supports retry budget enforcement. |
| `error_code` | Category-level error code | Must not contain private payload. |
| `error_summary` | Optional sanitized summary | Must not contain raw imported content. |
| `target_type` | Created or affected object type | Example only: tree/memory/staging record; exact values require approval. |
| `target_id` | Created or affected record id | Only if applicable and safe for the caller. |
| `created_at` | Item creation timestamp | Required. |
| `updated_at` | Last status update timestamp | Required. |

## Allowed item statuses

| Status | Meaning |
| --- | --- |
| `pending` | Item recorded but not yet attempted. |
| `processing` | Item is currently being processed. |
| `succeeded` | Item completed successfully. |
| `failed` | Item failed and is not currently retrying. |
| `skipped` | Item intentionally skipped, for example duplicate or invalid item. |
| `cancelled` | Item cancelled because the parent job was cancelled. |

## Idempotency and uniqueness

Future implementation must define all uniqueness and idempotency scopes before any migration.

Recommended constraints or equivalents:

- one active job per `created_by` and `idempotency_key`, if the API accepts client-provided idempotency keys;
- one item per `job_id` and normalized `source_id`;
- optional unique target mapping if one source item must never create more than one target record;
- normalized duplicate handling within the same submitted batch;
- retry behavior that updates the existing job/item rows rather than creating duplicate targets.

A repeated request must not create duplicate trees, memories, or public records unless product explicitly defines duplicate creation as valid behavior.

## Index considerations

Candidate indexes or equivalent access paths:

- `import_jobs(created_by, created_at)` for user/admin job lists;
- `import_jobs(status, created_at)` for worker job discovery if polling is used;
- `import_jobs(idempotency_key)` with the correct owner scope;
- `import_job_items(job_id, status)` for progress and retry queries;
- `import_job_items(job_id, source_id)` for duplicate detection inside a job;
- optional target lookup index if the import creates target records.

Any real index proposal must be checked against the active database and migration-risk profile before production.

## Migration-risk considerations

A future schema PR must answer:

- whether tables are empty at creation or backfilled;
- whether the migration can be applied without locking active runtime paths;
- whether indexes can be created safely for the expected table size;
- rollback steps if table creation or index creation fails;
- cleanup steps for abandoned queued or processing jobs;
- retention policy for completed/failed job records;
- whether private source payloads are avoided or encrypted/redacted.

## Security and privacy requirements

- Do not store raw imported private payloads unless explicitly approved.
- Do not store credentials, tokens, cookies, sessions, API keys, or service-account material.
- `error_summary` and `error_code` must be sanitized.
- Reports must use category-level counts and statuses.
- Access to job status must be scoped to the correct owner/admin boundary.
- Target identifiers must be exposed only when safe for the caller and product flow.

## Relationship to follow-up issues

- #562 should define accepted/status API contracts against this storage contract.
- #563 should define how workers claim and update jobs/items.
- #564 should decide whether progress UI is needed and what status can be shown.
- #565 should define staging, rollback, and rollout gates before production mutation.

## Closure criteria for #561

#561 can close when the durable job/item storage contract is documented and future migration or implementation work is explicitly split or deferred.

This document satisfies only the planning contract. It does not authorize schema deployment or production data mutation.
