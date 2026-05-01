# Modal Repository / Query Split Implementation Readiness

> Status: planning and readiness guardrail
> Related: #423, #223, #400
> Runtime impact: none

## 1. Purpose

Issue #423 tracks future narrow implementation work for splitting Modal repository/query helpers from `modal_compute/app.py`.

This document converts the earlier Modal repository/query split planning work into a concrete implementation-readiness checklist for future PRs. It defines when a first narrow extraction PR is justified, which files may be touched, which combinations are forbidden, and what verification is required before merge.

This document is docs-only. It does not modify Python, route handlers, database access, auth behavior, validation behavior, deployment configuration, frontend code, or runtime behavior.

## 2. Prior planning basis

Prior planning was documented by PR #326 in `docs/engineering/MODAL_REPOSITORY_QUERY_SPLIT_PLAN.md`.

That plan established these baseline decisions:

- `modal_compute/app.py` remains the route handler surface.
- Route decorators stay in `app.py` until explicitly approved.
- Helper extraction must be staged.
- DB, auth, validation, route movement, and deployment concerns must not be combined casually.
- Backend contract coverage is required before extraction.

Issue #423 should therefore not begin with a broad refactor. The next implementation must be one narrow helper group with contract coverage and no route decorator movement.

## 3. Current implementation posture

| Area | Current posture | Readiness judgment |
| --- | --- | --- |
| Route decorators | Stay in `modal_compute/app.py`. | Not ready for movement. Requires explicit CTO approval and separate route-surface plan. |
| Public read helpers | Candidate first extraction area. | Potentially ready only after current behavior is covered by backend contract tests. |
| Owner/private read helpers | Candidate later extraction area. | Higher risk because owner scoping and auth context must be preserved. |
| Private write helpers | Candidate later extraction area. | Higher risk because writes combine validation, auth, ownership, and persistence. |
| Ownership helpers | Separate future boundary. | Do not combine with query helper extraction unless explicitly approved. |
| DB connection helpers | Already separated in current architecture. | Do not alter from #423 unless a dedicated DB-helper issue exists. |
| Validation helpers | Already separated in current architecture. | Do not mix validation changes with repository/query extraction. |
| Modal deployment config | Out of scope. | Do not modify from #423. |

## 4. First implementation candidate

Recommended first implementation candidate, if CTO approves code work later:

```text
Extract public read query helpers only.
```

Candidate file shape:

```text
modal_compute/public_reads.py
modal_compute/app.py
relevant backend contract tests
```

Allowed first helper group:

- latest public tree snapshots
- growing public tree snapshots
- public memories for a tree
- single public memory read
- public tree metadata read

The route decorators should remain in `modal_compute/app.py`. `app.py` may call extracted helper functions, but routes should not move in the first implementation PR.

## 5. Explicitly forbidden first implementation candidates

Do not use #423's first implementation PR for:

- moving route decorators out of `modal_compute/app.py`;
- extracting public reads and private writes together;
- changing SQL query semantics;
- changing response shape;
- changing auth behavior;
- changing owner checks;
- changing validation rules;
- changing schema or migrations;
- changing deployment config;
- adding request logging or diagnostics;
- touching Cloudflare Functions routing;
- touching frontend JS/CSS/HTML/pages;
- touching PR #7/prototype/reference/demo/variant paths.

## 6. Allowed files for future implementation PRs

### First narrow public-read extraction PR

Allowed files, if explicitly approved:

- `modal_compute/app.py`
- `modal_compute/public_reads.py`
- backend contract tests under `tests/**` scoped to Modal public read behavior
- optional docs update to this readiness document or the original split plan

Forbidden files:

- `functions/api/[[path]].js`
- frontend JS/CSS/HTML/page files
- deployment config files
- package/dependency files
- GitHub Actions workflows
- PR #7/prototype/reference/demo/variant paths

### Later private read/write extraction PRs

These require separate approval and should have their own issue/PR:

- `modal_compute/private_reads.py`
- `modal_compute/private_writes.py`
- ownership helper file only if separately scoped
- contract tests for auth/owner/private access

Do not start these before the public-read extraction pattern is proven or before CTO explicitly selects a different first path.

## 7. Required backend contract coverage

Before extracting helpers, tests must establish current behavior for the targeted routes.

For public read extraction, cover:

- latest public trees route returns the expected route-level shape;
- growing public trees route returns the expected route-level shape;
- public memories route preserves parent/tree filtering behavior;
- single public memory route preserves not-found and success behavior;
- public tree route preserves visibility and not-found behavior;
- response field names remain unchanged;
- error status behavior remains unchanged;
- route imports remain stable after extraction.

For private read/write extraction, separately cover:

- auth-required behavior;
- owner scoping;
- forbidden/not-found behavior;
- validation failure behavior;
- write success behavior;
- no unintended data change on denied requests.

## 8. Modal runtime verification requirements

A future runtime-affecting Modal PR must include:

- `git diff --check` PASS;
- Python syntax check for touched Modal files;
- targeted backend contract tests PASS;
- broader repository static verification PASS where applicable;
- runtime verification plan using the Modal diagnostics workflow if deployment/runtime verification is required;
- route list before/after comparison showing no accidental route movement;
- explicit statement that route decorators stayed in `app.py`, unless the PR is specifically approved to move them.

## 9. No-behavior-change standard

For a helper extraction PR to qualify as a safe first implementation:

- route paths must remain unchanged;
- HTTP methods must remain unchanged;
- response shape must remain unchanged;
- DB queries must remain semantically unchanged;
- auth and owner policy must remain unchanged;
- validation behavior must remain unchanged;
- error handling and fallback behavior must remain unchanged;
- deployment configuration must remain unchanged.

If any of those are intentionally changed, the PR is not a repository/query extraction PR and must be split into a separate implementation issue.

## 10. Keep-open decision for Issue #423

Issue #423 should remain open after this readiness document because the issue tracks future implementation, not only documentation.

Close #423 only after one of these occurs:

1. a first narrow implementation PR is approved, merged, and verified; or
2. CTO explicitly decides to defer Modal repository/query extraction indefinitely and records a no-implementation disposition.

Until then, this document is the readiness gate for future work.

## 11. Follow-up sequence

Recommended sequence:

1. Readiness document PR for #423.
2. Backend contract coverage PR for current public read behavior, if coverage is insufficient.
3. First implementation PR: public read helper extraction only.
4. Runtime verification / diagnostics report if required.
5. Reassess whether private read/write extraction is still justified.

## 12. Guardrails

- Do not move route decorators without explicit approval.
- Do not combine route movement with DB/auth/validation changes.
- Do not combine public reads and private writes in one first extraction PR.
- Do not combine Modal refactor work with request logging or diagnostics work.
- Do not change Cloudflare routing from #423.
- Do not touch frontend UI/runtime files from #423.
- Do not touch PR #7.
- Do not touch prototype/reference/demo/variant paths.

## Related

Refs #423
Refs #223
Refs #400
