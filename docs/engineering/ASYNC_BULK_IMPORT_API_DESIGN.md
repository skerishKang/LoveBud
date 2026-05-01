# Async Bulk Import API Design

Issue: #539

This document defines a planning-only design for handling large bulk registration/import requests, especially requests that may include 10,000+ numeric IDs. It does not implement runtime behavior, database schema, queue infrastructure, API routes, workers, UI, package changes, workflow changes, or production data imports.

## Purpose

Large imports should not be handled as one long synchronous HTTP request. The safe direction is an asynchronous job model that accepts a request quickly, records a durable job, processes work in chunks, and exposes progress/status without blocking the browser or a single API invocation.

## Non-goals

- Do not convert ordinary tree or memory save APIs to asynchronous behavior.
- Do not implement a synchronous 10,000+ ID insert endpoint.
- Do not add queue infrastructure in this design PR.
- Do not add package dependencies.
- Do not add database migrations.
- Do not add or modify Modal, Cloudflare, Neon, Auth, Search, Browse, Editor, or UI runtime code.
- Do not perform production bulk mutation tests.
- Do not print imported private payloads, secret values, token/session/cookie values, API keys, or credential material.
- Do not touch PR #7 or prototype/reference/demo/variant paths.
- Do not touch PR #450 files.

## Problem

A large synchronous import can create unsafe runtime behavior:

- request timeout;
- long database connection occupancy;
- high CPU or memory pressure;
- partial failure without clear recovery;
- duplicate inserts after client retry;
- unclear progress state for the caller;
- difficult rollback and verification;
- unintended Browse/Search cache or visibility impact if imported records become public;
- overclaimed verification if the request is accepted but fails mid-stream.

## Recommended API shape

The preferred model is request acceptance plus asynchronous processing:

```text
POST /api/imports
-> validate request envelope
-> create import job
-> return 202 Accepted with job id

worker
-> claim queued job
-> process IDs in bounded chunks
-> record progress and item outcomes

GET /api/imports/{job_id}
-> return category-level job status and counts
```

The API should return quickly after validating the request shape and creating the job. It should not process all imported IDs before responding.

## Candidate request contract

A future request envelope should be explicit about source and intent:

```json
{
  "sourceType": "numeric_id_batch",
  "importType": "to_be_defined",
  "ids": [123, 456],
  "idempotencyKey": "client-generated-or-server-assigned-key"
}
```

The exact `importType` is intentionally not decided here. Before implementation, product and backend owners must define whether the IDs represent public content IDs, YouTube/video IDs, fandom content IDs, internal numeric IDs, migration records, admin-only staging records, trees, memories, or another object type.

## Candidate response contract

A successful accepted response should use an explicit asynchronous status:

```json
{
  "jobId": "opaque-job-id",
  "status": "queued",
  "acceptedCount": 10000
}
```

The response must not imply that imported records already exist. It only means the job was accepted for asynchronous processing.

## Candidate job states

Recommended top-level job states:

| State | Meaning |
| --- | --- |
| `queued` | Job accepted but not yet processing. |
| `processing` | Worker is processing chunks. |
| `completed` | All valid items completed successfully. |
| `partial_failed` | Some items failed while others succeeded. |
| `failed` | Job failed before meaningful completion. |
| `cancelled` | Job was intentionally cancelled, if cancellation is implemented. |

Reports and UI must separate `queued`, `processing`, `completed`, `partial_failed`, and `failed`. A queued or processing job must not be reported as imported.

## Candidate data model

A future schema may use tables or equivalent durable storage similar to:

### `import_jobs`

- `id`
- `status`
- `total_count`
- `processed_count`
- `success_count`
- `failed_count`
- `created_by`
- `created_at`
- `started_at`
- `completed_at`
- `error_summary`
- `idempotency_key`

### `import_job_items`

- `job_id`
- `source_id`
- `status`
- `error_code`
- `created_tree_id` or `created_memory_id`, only if applicable
- `created_at`
- `updated_at`

This design does not authorize a migration. A schema PR must separately evaluate lock risk, indexes, unique constraints, rollback, and staging verification.

## Idempotency requirements

A safe bulk import must be idempotent. At minimum, future implementation must decide:

- idempotency key scope;
- duplicate request behavior;
- duplicate source ID behavior within one request;
- duplicate source ID behavior across jobs;
- unique constraints or upsert keys;
- retry behavior after partial failure;
- whether item-level retry is supported.

A repeated request must not create duplicate trees, memories, or public records unless product explicitly defines that as valid behavior.

## Chunking requirements

Workers should process bounded chunks rather than the full input in one transaction.

Future implementation must define:

- maximum IDs per submitted job;
- maximum IDs per processing chunk;
- maximum concurrent jobs per user/admin;
- retry budget;
- backoff strategy;
- transaction size and timeout limits;
- DB connection usage limits;
- safe pause/resume behavior.

The chunk size should be validated against the active runtime and database behavior before production rollout.

## Authorization and visibility requirements

Before any implementation, owners must decide:

- who is allowed to create import jobs;
- whether imports are user-facing, admin-only, or migration-only;
- whether imported records are public, private, draft, or staged;
- how imported records affect Browse/Search eligibility;
- whether imported public records should invalidate any Browse/Search cache;
- how owner attribution is assigned;
- how failed or skipped items are exposed without leaking private payloads.

Ordinary user tree/memory save behavior must remain synchronous unless product explicitly approves a separate behavior change.

## Verification requirements

A future implementation PR must include verification for:

- request accepted quickly with `202 Accepted` or equivalent;
- job status transitions are observable;
- chunking prevents a single long-running synchronous request;
- idempotency prevents duplicate inserts on retry;
- partial failure is visible without exposing private payloads;
- failed items can be counted without printing private content;
- unauthorized callers cannot create or read jobs;
- Browse/Search impact is explicitly verified if imported records affect public data;
- no secret/token/session/cookie/API key/private payload exposure in logs or reports.

Production bulk mutation tests require explicit CTO approval and a rollback plan.

## Recommended PR split

1. **Design document** — this document. No runtime changes.
2. **Schema/contract proposal** — propose durable job/item storage, indexes, and idempotency keys. No production migration unless separately approved.
3. **API contract tests or stubs** — non-mutating or test-only contract coverage for `POST /api/imports` and `GET /api/imports/{job_id}`.
4. **Worker design and implementation** — only after queue/worker mechanism is approved.
5. **Admin/user progress UI** — only if the product requires user-visible progress.

## Closure criteria for #539

Issue #539 can be closed only when one of the following is true:

- the async bulk import design is documented and future implementation is split into approved follow-up issues;
- the full async import flow is implemented, verified, and deployed with safe job status tracking;
- CTO explicitly decides that bulk import is not needed and closes the issue as not planned.

This document satisfies only the design-document portion. It does not complete implementation, schema, worker, or UI work.
