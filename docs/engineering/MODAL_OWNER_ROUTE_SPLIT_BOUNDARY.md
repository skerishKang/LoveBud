# Modal Owner Route Split Boundary

Issue: #423

This document narrows the remaining Modal repository/query split work after public-read extraction. It is docs-only and does not authorize implementation.

## Current disposition

Completed or separately closed work:

- Public read helper extraction was completed through PR #507.
- Production public-read runtime verification was completed through #509.
- Request correlation was completed through #470.
- Modal structured logging was completed through #472.
- Cloudflare and Modal diagnostics workflow was documented through #473.
- Large-file routing now classifies `modal_compute/app.py` as audit-needed through #408.

Remaining #423 work should focus on owner-authenticated read/write boundaries and backend contract test gates.

## Route ownership map

| Route family | Domain | Extraction status | Next action |
| --- | --- | --- | --- |
| `/modal/browse/latest` | public read | helper extracted | Keep stable. |
| `/modal/browse/growing` | public read | helper extracted | Keep stable. |
| `/modal/community/memories` | public read | helper extracted | Keep stable; preserve parent tree visibility guard. |
| `/modal/memories/{memory_id}` | public detail read | helper extracted | Keep stable. |
| `/modal/trees/{tree_id}` | public detail read | helper extracted | Keep stable. |
| `/modal/private/trees` GET | owner read | not extracted | Candidate after owner read tests. |
| `/modal/private/trees/{tree_id}` GET | owner read | not extracted | Candidate after owner read tests. |
| `/modal/private/memories` GET | owner read | not extracted | Candidate after owner read tests. |
| `/modal/private/trees` POST | owner write | not extracted | Candidate after create-tree tests. |
| `/modal/private/memories` POST | owner write | not extracted | Candidate after create-memory tests. |
| `/modal/private/trees/{tree_id}` PUT/DELETE | owner write | not extracted | Candidate after update/delete tests. |
| `/modal/private/memories/{memory_id}` PUT/DELETE | owner write | not extracted | Candidate after update/delete tests. |
| `/modal/private/trees/{tree_id}/fork` POST | owner write plus public source read | not extracted | Keep separate from ordinary owner writes. |

## Allowed future PR shapes

### PR A — owner read contract tests

Goal:
- Add or document tests for owner private tree and memory reads before extraction.

Allowed:
- test files or docs-only test plan.
- no route movement.
- no behavior change.

Required coverage:
- owner tree list read.
- owner tree detail read.
- owner memory list read.
- non-owner denial or not-found behavior.
- visibility interactions for owner reads.

### PR B — owner read helper extraction

Precondition:
- PR A completed or equivalent evidence accepted.

Allowed:
- extract owner read query helpers from `modal_compute/app.py` into a Modal-owned helper module.
- keep FastAPI route decorators in `modal_compute/app.py` unless separately approved.
- preserve response shape and status codes.

Forbidden:
- no owner write extraction in the same PR.
- no validation or identity behavior changes unless separately approved and tested.

### PR C — owner write contract tests

Goal:
- Add or document tests for create, update, delete, and fork behavior before extraction.

Required coverage:
- create tree.
- create memory.
- update tree.
- update memory.
- delete tree.
- delete memory.
- fork public tree.
- owner-only access enforcement.

### PR D — owner write helper extraction

Precondition:
- PR C completed or equivalent evidence accepted.

Allowed:
- extract owner write helpers by one responsibility family.
- preserve SQL, validation, response shape, and status codes.
- keep route decorators in `modal_compute/app.py` unless separately approved.

Forbidden:
- no public read changes.
- no route decorator movement.
- no database schema changes.
- no Cloudflare gateway changes.

### PR E — route decorator movement, only if still necessary

Precondition:
- owner read/write helpers are extracted and tests are accepted.
- CTO explicitly approves decorator movement.

Allowed:
- one route family at a time.

Forbidden:
- no broad Modal app rewrite.
- no route movement mixed with DB, identity, validation, or response-shape changes.

## Backend contract gate

Any implementation PR touching owner-route helpers must verify or explicitly mark `NOT_VERIFIED` for:

- response shape compatibility.
- status code compatibility.
- owner-only access guard.
- private visibility behavior where applicable.
- public read unaffected.
- Cloudflare same-origin `/api/*` mapping unaffected.
- no private payload or credential value exposure in reports.

If tests are not available, the PR must be docs-only or remain blocked until a test plan is accepted.

## Cloudflare boundary

The Cloudflare Pages Function gateway is not part of #423 unless route mapping change is explicitly approved.

Do not change from #423 alone:

- `functions/api/[[path]].js` route matching.
- request ID propagation.
- upstream or degraded response headers.
- same-origin `/api/*` mapping.
- method-not-allowed or unhandled-route behavior.

Gateway changes require separate gateway ownership approval and API smoke verification.

## Verification expectations

| Change type | Minimum verification |
| --- | --- |
| docs-only | static review and changed-file scope check |
| owner read tests only | test command or documented `NOT_VERIFIED` if no harness exists |
| owner read helper extraction | backend contract tests plus scoped runtime API smoke |
| owner write tests only | test command or documented `NOT_VERIFIED` if no harness exists |
| owner write helper extraction | backend contract tests plus fixed-slot API smoke for safe route groups |
| route decorator movement | tests plus fixed-slot API smoke and route mapping check |

Production mutation tests are not allowed unless separately approved.

## Closure criteria for #423

#423 should remain open until one of these is true:

1. owner read and owner write helper extraction are completed with accepted tests and runtime verification; or
2. CTO explicitly decides that further Modal extraction is not currently needed and closes the issue with a disposition note.

This document alone should not close #423. It narrows the remaining work and prevents broad unsafe refactors.

## Guardrails

- No implementation changes.
- No route decorator movement.
- No broad Modal route migration.
- No DB, identity, validation, or response-shape behavior changes.
- No Cloudflare gateway changes.
- No package, workflow, or config changes.
- No PR #7/prototype/reference/demo/variant changes.
- No private payload or credential values included.
