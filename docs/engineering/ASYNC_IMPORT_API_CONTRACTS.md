# Async Import API Contracts

Issue: #562
Related design: #539, #560
Related storage contract: #561

This document defines planning-only API contracts for future async import request acceptance and job-status reads. It does not implement production routes, database schema, worker/queue behavior, UI, package changes, workflow changes, deployment changes, or production data mutation.

## Purpose

Large import requests must not be reported as completed merely because the server accepted the request. A future async import API needs clear contracts that separate request acceptance, queued processing, active processing, terminal success, terminal partial failure, and terminal failure.

This document defines the expected request and response semantics for a future `POST /api/imports` acceptance endpoint and `GET /api/imports/{job_id}` status endpoint.

## Non-goals

- No production API route implementation.
- No database migration.
- No worker or queue implementation.
- No UI or progress screen implementation.
- No Browse/Search cache behavior change.
- No Editor/Auth/My Trees changes.
- No package, workflow, deployment, or infrastructure changes.
- No production bulk mutation test.
- No PR #7/prototype/reference/demo/variant changes.
- No PR #450 changes.
- No secret/token/session/cookie/API key/private payload output.

## Contract principles

Future implementation must follow these principles:

1. `POST /api/imports` accepts or rejects a job request; it does not complete the import.
2. Accepted jobs must return an async status such as `queued`, not an imported/success-complete status.
3. `GET /api/imports/{job_id}` is the source of truth for progress and terminal outcome.
4. Counts must be category-level and must not expose raw private imported content.
5. Idempotent retry must not create duplicate target records.
6. Unauthorized callers must not create jobs or read job status outside their boundary.

## `POST /api/imports` request contract

Candidate request envelope:

```json
{
  "sourceType": "numeric_id_batch",
  "importType": "to_be_defined",
  "ids": [123, 456],
  "idempotencyKey": "client-generated-or-server-assigned-key"
}
```

### Request fields

| Field | Required | Meaning | Notes |
| --- | --- | --- | --- |
| `sourceType` | YES | Type of source identifiers | Initial planned value may be `numeric_id_batch`. |
| `importType` | YES | Product intent of the import | Must be defined before implementation. |
| `ids` | YES | Submitted identifiers | Must be bounded and validated before job creation. |
| `idempotencyKey` | YES/CONDITIONAL | Retry/dedup key | Exact requirement depends on final idempotency design. |

## `POST /api/imports` response contract

### Accepted response

A successfully accepted request should use an explicit async response, preferably HTTP `202 Accepted` or an equivalent internal convention if the runtime requires another status.

```json
{
  "jobId": "opaque-job-id",
  "status": "queued",
  "acceptedCount": 10000
}
```

Rules:

- `status` must not be `completed` in the initial accepted response.
- `acceptedCount` means item count accepted into the job envelope, not imported records created.
- `jobId` must be opaque to untrusted clients.
- Response must not include private raw imported content.

### Validation failure response

Invalid request shape should fail before job creation.

Recommended category-level response shape:

```json
{
  "error": "invalid_import_request",
  "message": "Import request is invalid.",
  "details": {
    "reason": "too_many_ids"
  }
}
```

Rules:

- Error details must be category-level.
- Do not echo the full submitted `ids` array.
- Do not print private payloads.

### Authorization failure response

Unauthorized callers must not create import jobs.

Recommended category-level response shape:

```json
{
  "error": "forbidden",
  "message": "Not allowed to create import jobs."
}
```

Rules:

- Do not reveal whether private target records exist.
- Do not reveal owner IDs or private imported content.

## `GET /api/imports/{job_id}` status contract

Candidate response envelope:

```json
{
  "jobId": "opaque-job-id",
  "status": "processing",
  "totalCount": 10000,
  "processedCount": 2500,
  "successCount": 2400,
  "failedCount": 50,
  "skippedCount": 50,
  "createdAt": "timestamp",
  "startedAt": "timestamp-or-null",
  "completedAt": null,
  "errorSummary": null
}
```

Rules:

- Counts must be internally consistent.
- `processedCount` must not exceed `totalCount`.
- `successCount + failedCount + skippedCount` must not exceed `processedCount` unless a final implementation explicitly defines another accounting model.
- `errorSummary` must be sanitized and category-level.
- The response must not include raw imported private payloads.

## Allowed job states

| State | Terminal | Meaning |
| --- | --- | --- |
| `queued` | NO | Job accepted but not yet processing. |
| `processing` | NO | Worker is processing chunks. |
| `completed` | YES | All valid items completed successfully. |
| `partial_failed` | YES | Some items failed while others succeeded or were skipped. |
| `failed` | YES | Job failed before meaningful completion or all items failed. |
| `cancelled` | YES | Job intentionally cancelled, if cancellation is implemented. |

Status reports, UI, and verification must not treat `queued` or `processing` as completed imports.

## Idempotency behavior

Future implementation must define exact idempotency behavior before route implementation.

Recommended expectations:

- Same caller + same `idempotencyKey` + same normalized request should return the existing job, not create a duplicate job.
- Same caller + same `idempotencyKey` + different normalized request should fail with a category-level idempotency conflict.
- Duplicate source IDs inside one request should be normalized and handled deterministically.
- Retrying after a network failure must not duplicate target records.
- Item-level retries should update existing job item rows rather than creating duplicate target rows.

## Error categories

Recommended top-level error codes:

| Error | Meaning |
| --- | --- |
| `invalid_import_request` | Request shape or limits invalid. |
| `forbidden` | Caller is not allowed to create/read the job. |
| `not_found` | Job does not exist or is not visible to caller. |
| `idempotency_conflict` | Same key reused with a different normalized request. |
| `job_not_ready` | Optional, if an operation requires a terminal state. |
| `internal_error` | Generic server failure without private details. |

Error responses must not expose credentials, tokens, sessions, cookies, API keys, owner identifiers, raw imported content, or private target details.

## Verification requirements for future implementation

A future implementation PR must verify:

- invalid request does not create a job;
- unauthorized request does not create a job;
- accepted request returns `queued` or equivalent async status;
- accepted response does not imply records were imported;
- status endpoint returns queued/processing/terminal states distinctly;
- idempotent retry does not create duplicate jobs or target records;
- idempotency conflict is category-level and does not expose payloads;
- status responses are scoped to the correct caller/admin boundary;
- no private payloads or credentials appear in logs, PR bodies, issue comments, or reports.

## Relationship to other follow-ups

- #561 defines storage contract fields and status persistence.
- #563 must define worker claim/update behavior before real processing.
- #564 must define whether and how progress is shown in UI.
- #565 must define staging, rollback, and production rollout gates.

## Closure criteria for #562

#562 can close when accepted/status API contract behavior is documented and any implementation/test work is explicitly split or deferred.

This document satisfies only the planning contract. It does not authorize production route implementation or data mutation.
