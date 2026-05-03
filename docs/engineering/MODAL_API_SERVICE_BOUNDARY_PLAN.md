# Modal API Service Boundary Plan

**Status:** Active staged-refactor boundary  
**Owner:** CTO / Backend Lead  
**Related issue:** #660  
**Depends on:** #656 large-file audit, #423 owner route split boundary

This document defines a staged, behavior-preserving plan for reducing `modal_compute/app.py` responsibility without changing the active Cloudflare Pages plus Modal runtime contract.

The Modal app is a high-risk backend boundary. It handles route dispatch, authentication, ownership and visibility policy, database access, serialization, retry/error handling, and public/private read/write behavior. Any split must preserve current response shapes, status codes, auth semantics, and Cloudflare same-origin `/api/*` expectations.

---

## 1. Boundary principle

The first implementation PRs should reduce responsibility without moving route decorators.

Route decorators in `modal_compute/app.py` are part of the observable application surface and should remain in place until helper extraction and contract coverage are accepted. A safe split extracts pure or near-pure service/helper functions first, then leaves route handlers as thin orchestration wrappers.

Do not combine route movement, database query changes, ownership policy changes, response shape changes, and retry/error behavior changes in a single PR.

---

## 2. Responsibility buckets

`modal_compute/app.py` should be treated as multiple responsibility buckets, not one generic backend file.

| Bucket | Examples | First safe action |
| --- | --- | --- |
| Route handler orchestration | FastAPI decorators, request parsing, response return | Keep decorators in app; make wrappers thinner later |
| Auth identity bridge | Firebase token verification, user identity extraction | Preserve behavior; no first-step extraction unless tests exist |
| Ownership/visibility guards | owner-only checks, public/private visibility checks | Extract only with contract coverage |
| Public read services | browse/latest/growing/community/detail reads | Keep stable unless follow-up proves need |
| Owner read services | private tree/memory list/detail reads | Candidate after owner-read contract tests |
| Owner write services | create/update/delete/fork writes | Candidate after owner-write contract tests |
| Serialization | camelCase response shape, safe public/private fields | Extract only with response-shape tests |
| Retry/error handling | DB retry, not-found/denial mapping, degraded errors | Extract after current behavior map is documented |
| Database query helpers | SQL/query assembly, row mapping | Extract one route family at a time |

---

## 3. Preserved contracts

The following must remain equivalent unless a separate API-contract PR explicitly changes them:

```text
HTTP method and route path
status code
response shape and key casing
public/private field exposure
owner-only access behavior
anonymous public-read behavior
parent-tree visibility guard behavior
error response shape
retry/degraded behavior
Cloudflare same-origin /api mapping
request ID propagation expectations
```

Reports must not include raw private payloads, database rows, credentials, tokens, sessions, cookies, owner IDs, tree IDs, memory IDs, copied tree IDs, or DB row values.

Use safe labels only:

```text
OWNER_GUARD: PASS/FAIL/NOT_VERIFIED
VISIBILITY_GUARD: PASS/FAIL/NOT_VERIFIED
RESPONSE_SHAPE: PASS/FAIL/NOT_VERIFIED
STATUS_CODE: PASS/FAIL/NOT_VERIFIED
PRIVATE_PAYLOAD_EXPOSURE: NO/YES
```

---

## 4. Recommended implementation sequence

### PR A — service boundary contract tests or test plan

Goal:
- Add or document contract coverage for the route family targeted by the first extraction.

Preferred coverage:
- route exists;
- method accepted/rejected behavior;
- status code compatibility;
- response shape compatibility;
- owner/non-owner behavior where relevant;
- public/private visibility behavior;
- no private payload exposure.

No runtime behavior change.

### PR B — owner read helper extraction

Precondition:
- owner read coverage exists or CTO accepts a documented test gap.

Allowed:
- extract owner tree/memory read query helpers;
- keep decorators and route entrypoints in `modal_compute/app.py`;
- preserve SQL semantics and response shape;
- preserve denial/not-found mapping.

Forbidden:
- no writes;
- no public route changes;
- no Cloudflare gateway changes;
- no response renaming.

### PR C — owner write helper extraction

Precondition:
- owner write contract coverage exists or CTO accepts a documented test gap.

Allowed:
- extract one write family at a time, such as create tree or create memory;
- preserve auth, ownership, validation, SQL, and response shape.

Forbidden:
- no multiple write families unless tightly coupled;
- no schema change;
- no entitlement or visibility policy redesign.

### PR D — serialization helper extraction

Precondition:
- response-shape contract coverage exists.

Allowed:
- extract row-to-response serializers;
- preserve camelCase shape and public/private field filtering.

Forbidden:
- no field additions/removals;
- no private field exposure changes.

### PR E — retry/error helper extraction

Precondition:
- current error/status behavior is documented for the route family.

Allowed:
- extract shared retry or error mapping helpers.

Forbidden:
- no new error codes or changed status mapping unless separately approved.

### PR F — route decorator movement, only if still necessary

Precondition:
- helper extraction is complete for that route family;
- contract coverage exists;
- CTO explicitly approves route movement.

Allowed:
- move one route family at a time.

Forbidden:
- no broad Modal app rewrite.

---

## 5. Contract gate for each PR

Every implementation PR touching Modal API behavior must include this matrix in the PR body or verification comment:

```text
[Modal API Contract Gate]
Route family:
Changed files:
Route decorators moved: YES/NO
Auth behavior changed: YES/NO
Ownership behavior changed: YES/NO
Visibility behavior changed: YES/NO
DB schema changed: YES/NO
Response shape changed: YES/NO
Status code changed: YES/NO
Cloudflare gateway changed: YES/NO
Contract tests: PASS/FAIL/NOT_RUN
Runtime smoke: PASS/PARTIAL/BLOCKED/NOT_RUN
Private payload exposure: NO
Secret exposure: NO
Final judgment: PASS/PARTIAL/BLOCKED/FAIL
```

If any behavior is intentionally changed, the PR is no longer a behavior-equivalent refactor and must be rescoped.

---

## 6. Runtime verification requirements

Static checks are necessary but not sufficient for Modal API behavior changes.

Minimum static checks:

```text
git diff --check
relevant backend contract tests
npm test
npm run verify
```

Runtime/API smoke should use safe, non-production-mutation paths unless CTO explicitly approves a mutation test. If a write route must be tested, use approved disposable test data and report only status labels.

Required safe observations:

```text
route reachable: YES/NO
request authenticated where required: YES/NO/NOT_REQUIRED
owner guard: PASS/FAIL/NOT_VERIFIED
visibility guard: PASS/FAIL/NOT_VERIFIED
response shape: PASS/FAIL/NOT_VERIFIED
status code: PASS/FAIL/NOT_VERIFIED
5xx regression: YES/NO
private payload exposure: NO
secret exposure: NO
```

---

## 7. Cloudflare boundary

Do not change Cloudflare Pages Functions gateway behavior as part of #660 unless explicitly approved.

Out of scope for first Modal service extraction:

```text
functions/api/[[path]].js route mapping
same-origin /api path contract
request ID propagation
upstream/degraded response headers
Cloudflare cache behavior
method-not-allowed behavior
unhandled-route behavior
```

Any Cloudflare gateway change requires a separate gateway PR and fixed-slot API/browser verification.

---

## 8. Forbidden combinations

Do not combine Modal API service extraction with:

- frontend UI work;
- Auth provider changes;
- database schema changes;
- visibility/product policy changes;
- package/workflow changes;
- Cloudflare gateway changes;
- PR #7 or prototype/reference/demo/variant changes;
- production data mutation;
- broad route decorator movement.

---

## 9. First implementation recommendation

The safest first code PR is not broad extraction. It should be one of:

1. Add owner-read or owner-write contract tests for one route family.
2. Extract a narrow owner-read query helper with route decorators left in `app.py`.
3. Extract a pure serializer only after response-shape tests exist.

Do not start with route decorator movement or write-route behavior changes.

---

## 10. Closure criteria for #660

Issue #660 should remain open until one or more implementation PRs reduce `modal_compute/app.py` responsibility while preserving behavior and recording required contract/runtime evidence.

A docs-only boundary PR can make the issue implementation-ready, but it does not complete the refactor by itself.
