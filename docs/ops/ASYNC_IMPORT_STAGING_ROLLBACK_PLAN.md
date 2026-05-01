# Async Import Staging and Rollback Verification Plan

Issue: #565
Related design: #539, #560
Related contracts: #561, #562, #563, #564

This document defines staging, rollback, and production-safety verification requirements for any future async import rollout. It is docs/ops planning only. It does not implement runtime/API/backend behavior, database migration, worker/queue behavior, UI, package changes, workflow changes, deployment changes, or production data mutation.

## Purpose

Async import work may eventually create or modify many records. Before any production rollout, LoveBud needs explicit staging verification, mutation boundaries, rollback expectations, and reporting rules that avoid private payload or credential exposure.

This document is a gate: implementation work must not use production bulk mutation as the first proof point.

## Non-goals

- No production data mutation.
- No runtime/API/backend implementation.
- No database migration.
- No worker/queue implementation.
- No UI work.
- No Browse/Search cache behavior changes.
- No Editor/Auth/My Trees changes.
- No package, workflow, deployment, or infrastructure changes.
- No PR #7/prototype/reference/demo/variant changes.
- No PR #450 changes.
- No secret/token/session/cookie/API key/private payload output.

## Required rollout phases

Future implementation must be verified in phases:

1. **Docs/contract phase** — design and contract documents only.
2. **Local/test-only phase** — isolated tests or stubs with no production mutation.
3. **Staging phase** — bounded staging data and rollback rehearsal.
4. **Fixed-slot verification phase** — allowed Cloudflare target with expected SHA match, if browser/runtime verification is needed.
5. **Production rollout phase** — only after explicit CTO approval, runtime owner approval, and rollback readiness.

Production must not be used to discover basic correctness.

## Staging environment requirements

Before staging mutation tests, owners must define:

- exact staging environment or test slot;
- expected commit SHA;
- data scope and maximum item count;
- whether data is synthetic, fixture-based, or owner-approved copied data;
- cleanup owner;
- rollback owner;
- verification owner;
- allowed observation surfaces;
- report format.

For browser verification, only allowed Cloudflare targets may be used. Netlify, Vercel, old deployment URLs, unassigned fixed slots, and URLs from local browser history are not valid proof.

## Safe test data policy

Default policy:

- Use synthetic or fixture data.
- Use small bounded batches first.
- Do not import private user payloads for initial staging proof.
- Do not print raw imported records in reports.
- Do not expose owner IDs, copied tree IDs, database row values, credentials, tokens, cookies, sessions, API keys, or service-account material.

Allowed report evidence:

- category-level counts;
- status transitions;
- PASS/FAIL state;
- error category names;
- redacted screenshots if browser UI is later involved;
- commit SHA and allowed target URL.

Disallowed report evidence:

- raw imported IDs when they are private or user-derived;
- private content payloads;
- database row dumps;
- auth tokens or session values;
- service credentials;
- copied tree IDs or private owner IDs;
- raw request/response bodies containing private payloads.

## Mutation boundaries

Before any mutation test, define:

| Boundary | Required decision |
| --- | --- |
| Environment | local, staging, fixed slot, or production; production requires explicit approval. |
| Max job count | maximum jobs that may be created. |
| Max item count | maximum items per job and total items. |
| Target records | whether test creates trees, memories, staging records, or no targets. |
| Cleanup | exact cleanup mechanism and owner. |
| Visibility | whether records can become public/searchable. |
| Cache impact | whether Browse/Search cache invalidation or observation is needed. |
| Rollback | manual or scripted rollback path. |

Any import that can create public content requires explicit Browse/Search visibility and cache impact review before rollout.

## Rollback plan requirements

A future implementation must define rollback before production rollout:

- how to stop new job creation;
- how to stop or pause workers;
- how to identify jobs created by the rollout;
- how to cancel queued jobs;
- how to handle processing jobs;
- how to remove or mark test-created target records if cleanup is approved;
- how to restore previous code path if needed;
- how to verify rollback completion with category-level evidence.

Rollback must not rely on hidden local state or untracked manual notes.

## Cleanup plan requirements

Cleanup must be defined separately from rollback.

Cleanup plan must specify:

- which staging/test records may be deleted;
- which records must be retained for audit;
- who owns cleanup;
- how cleanup is verified;
- how reports avoid private payload exposure.

No cleanup step may delete production user data unless explicitly approved with a narrow target and rollback record.

## Production rollout gates

Production rollout is blocked until all are true:

- #561 storage contract has an approved implementation or explicit no-migration decision;
- #562 API contract has approved behavior and tests;
- #563 worker/queue mechanism has approved implementation scope;
- #564 UI visibility decision is resolved if any UI is touched;
- staging test passed with bounded data;
- rollback plan exists and was rehearsed or reviewed;
- logging/reporting redaction is verified;
- runtime owner approves worker/API behavior;
- CTO explicitly approves production mutation.

## Verification checklist for future implementation PRs

A future implementation PR must report:

```text
1. Verification environment:
2. URL or target, if browser/runtime verification used:
3. URL host allowed: YES / NO / NOT_APPLICABLE
4. Expected PR head SHA:
5. Deployed SHA:
6. SHA match: YES / NO / NOT_APPLICABLE
7. Test data type: synthetic / fixture / owner-approved
8. Max job count:
9. Max item count:
10. Job state coverage:
11. Rollback plan present: YES / NO
12. Cleanup plan present: YES / NO
13. Private payload exposure: YES / NO
14. Secret/token/session/cookie/API key exposure: YES / NO
15. Production mutation performed: YES / NO
16. If production mutation YES: CTO approval reference
17. Final status: PASS / FAIL / BLOCKED
```

## Stop conditions

Stop and report `BLOCKED` if:

- target URL is not allowed;
- deployed SHA does not match expected SHA;
- staging data source is not approved;
- rollback plan is missing;
- cleanup owner is missing;
- production mutation is requested without explicit CTO approval;
- private payloads or credentials appear in logs/reports;
- job counters or terminal states are inconsistent;
- unauthorized visibility is observed.

## Relationship to follow-up issues

- #561 defines durable storage contract.
- #562 defines accepted/status API contract.
- #563 defines worker/queue design.
- #564 defines UI/progress visibility planning.

## Closure criteria for #565

#565 can close when staging, rollback, cleanup, production gate, and reporting requirements are documented and implementation remains either explicitly deferred or split into separately approved work.

This document satisfies only the planning gate. It does not authorize production rollout, data mutation, schema changes, or runtime implementation.
