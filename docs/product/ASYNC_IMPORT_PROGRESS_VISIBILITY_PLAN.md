# Async Import Progress Visibility Plan

Issue: #564
Related design: #539, #560
Related contracts: #561, #562, #563

This document plans whether and how async import job progress should be visible to admins or users. It is product/design planning only. It does not implement frontend UI, CSS, motion, runtime API, backend, database migration, worker, queue, deployment, package, workflow, or production data mutation.

## Purpose

Async import jobs can have queued, processing, completed, partial failure, failed, or cancelled states. If these jobs become product-visible, LoveBud needs clear visibility boundaries and safe status language before any UI implementation.

The primary goal is to prevent misleading states such as treating an accepted job as completed, and to avoid exposing private imported payloads, owner identifiers, credentials, or sensitive operational details.

## Non-goals

- No frontend implementation.
- No Editor/Auth/My Trees/Search/Browse runtime changes.
- No CSS or motion work.
- No API/backend implementation.
- No database migration.
- No worker/queue implementation.
- No production data mutation.
- No PR #7/prototype/reference/demo/variant changes.
- No PR #450 changes.
- No secret/token/session/cookie/API key/private payload output.

## Visibility decision

Default recommendation:

- Admin-visible progress should be considered first.
- User-visible progress should remain deferred until product confirms a user-facing import flow.
- If imports are admin-only or migration-only, no public user progress UI should be built.
- If user-facing import is later approved, the UI must expose only safe status and counts.

## Audience boundaries

| Audience | Visibility recommendation | Notes |
| --- | --- | --- |
| Internal admin/operator | MAY view job list and category-level progress | Requires role/owner boundary before implementation. |
| Import creator | MAY view own job status if product-facing import is approved | Must not expose other users' jobs. |
| General signed-in user | NO by default | No access unless explicit product flow exists. |
| Public/anonymous viewer | NO | Async import progress is not public content. |

## Safe status presentation

Future UI must distinguish these states:

| State | Suggested display | Product meaning |
| --- | --- | --- |
| `queued` | Queued | The job was accepted but work has not started. |
| `processing` | Processing | Work is in progress. Imported records are not guaranteed complete. |
| `completed` | Completed | Valid items reached a successful terminal state. |
| `partial_failed` | Completed with issues | Some items failed or were skipped. |
| `failed` | Failed | The job did not complete successfully. |
| `cancelled` | Cancelled | The job was intentionally stopped, if cancellation exists. |

UI and reports must not label `queued` or `processing` as done, imported, saved, published, or completed.

## Count presentation

Allowed count fields, if exposed:

- total count;
- processed count;
- success count;
- failed count;
- skipped count;
- last updated time;
- terminal status.

Counts must be category-level. Do not show raw imported IDs, private source content, owner IDs, credentials, tokens, sessions, cookies, API keys, or private target details.

## Error presentation

Recommended safe error categories:

| Category | Suggested UI copy |
| --- | --- |
| `validation_failed` | Some items could not be processed. |
| `authorization_failed` | Some items were not allowed. |
| `target_conflict` | Some items conflicted with existing records. |
| `transient_backend_error` | Temporary processing issue. Retry may be needed. |
| `worker_interrupted` | Processing was interrupted. |
| `unknown_error` | An unknown issue occurred. |

Do not display stack traces, raw backend errors, service names with credentials, raw source IDs, private payloads, or database row details.

## Progress UI placement options

### Option A — Admin operations page

Best fit if imports are admin-only or migration-only.

Potential content:
- recent job list;
- status badge;
- category-level counts;
- last updated timestamp;
- sanitized terminal summary.

Risks:
- requires admin authorization boundary;
- requires product decision about retention and audit visibility.

### Option B — Import creator status page

Best fit if user-facing imports are approved.

Potential content:
- one user's submitted jobs;
- queued/processing/completed states;
- safe counts;
- non-sensitive retry guidance.

Risks:
- requires strict owner scoping;
- may imply import feature availability before backend is ready.

### Option C — No UI, operator report only

Best fit if imports are rare, migration-only, or fully internal.

Potential content:
- issue/PR verification reports;
- category-level status in admin-owned docs or runbooks;
- no product UI.

Risks:
- less discoverable for non-engineering operators;
- requires consistent reporting discipline.

## Recommended initial direction

Use Option C unless product confirms a user-facing import feature. If operational visibility is needed, plan Option A before any user-facing UI.

This keeps the async import work out of the main Editor/Auth/My Trees/Search/Browse product surface until implementation scope is approved.

## Required implementation gates

Before any UI implementation, owners must define:

- whether imports are admin-only, migration-only, or user-facing;
- who can see job list and job status;
- whether job IDs are shareable or strictly private;
- retention period for job history;
- whether cancellation or retry actions exist;
- exact API status contract from #562;
- storage fields and safe count rules from #561;
- worker state behavior from #563;
- staging and rollback policy from #565.

## Browser verification requirements for future UI

If implementation is later approved, browser verification must confirm:

- allowed Cloudflare target only;
- expected PR head SHA matches deployed preview/test slot;
- queued and processing are not shown as completed;
- terminal states are displayed distinctly;
- owner/admin boundary prevents unauthorized job visibility;
- no raw imported payloads or private identifiers are visible;
- no secret/token/session/cookie/API key/private payload exposure;
- no unintended Editor/Auth/My Trees/Search/Browse regressions if those surfaces are touched.

## Relationship to follow-up issues

- #561 defines durable job and item storage fields.
- #562 defines accepted/status API contracts.
- #563 defines worker and queue design.
- #565 defines staging, rollback, and production-safety verification gates.

## Closure criteria for #564

#564 can close when the progress visibility plan is documented and UI implementation remains either explicitly deferred or split into separately approved implementation issues.

This document satisfies only the planning contract. It does not authorize frontend implementation or product exposure.
