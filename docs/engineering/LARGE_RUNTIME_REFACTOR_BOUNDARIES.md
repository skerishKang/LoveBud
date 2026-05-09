# Large Runtime Refactor Boundaries

Issue: #656

This document refreshes the large runtime/client/backend refactor map after the creation of dedicated file-level issues #657 through #662.

It is a docs-only boundary document. It does not authorize implementation, file movement, ES module conversion, route movement, backend behavior changes, CSS redesign, browser script reordering, or broad architecture rewrites.

## Purpose

LoveBud currently has several runtime files at or near the 500-line reviewability threshold. The correct response is not a single broad cleanup PR. The correct response is a staged sequence of narrow issues and PRs, each with one owner domain, one responsibility boundary, and the validation level required by that runtime surface.

This document exists to:

- keep the large-file refactor work visible,
- map each large or near-large file to its dedicated issue,
- distinguish docs-only audit work from implementation work,
- prevent unrelated runtime domains from being bundled together,
- define the validation gate for each file before any merge-ready judgment,
- preserve PR #7 and prototype/reference/demo/variant guardrails.

## Current large-file issue map

| Issue | File or scope | Domain | Current priority | Intended PR shape |
| --- | --- | --- | --- | --- |
| #656 | Large runtime file audit and boundary map | Engineering docs | First | Docs-only audit PR |
| #657 | `js/editor/editor-detail-ui.js` | Editor detail UI | High | Narrow implementation PR after audit |
| #658 | `js/editor/editor-canvas.js` | Editor canvas | High | Narrow implementation PR after detail boundary or in a separate non-overlapping sequence |
| #659 | `js/editor.js` | Editor entrypoint/orchestration | Medium | Thin-entrypoint implementation after #657/#658 clarify boundaries |
| #660 | `modal_compute/app.py` | Modal backend/API | High risk, later sequence | Backend implementation only after contract/runtime validation plan |
| #661 | `js/detail.js` | Detail page runtime | Medium | Narrow implementation PR independent of Editor/Search/My Trees |
| #662 | `js/my-trees.js` | My Trees runtime | Medium/high validation | Narrow implementation PR with browser/test-slot validation |

## Candidate classification

| File | Classification | Why it is a candidate | Primary risk | Required gate before implementation |
| --- | --- | --- | --- | --- |
| `js/editor/editor-detail-ui.js` | `EXTRACTION_CANDIDATE` | Large UI file with render, inline edit, tree meta, action binding, and state reflection responsibilities. | Editor detail UI regression. | #657 scope confirmation and Editor browser smoke plan. |
| `js/editor/editor-canvas.js` | `EXTRACTION_CANDIDATE` | Large canvas file with rendering and interaction responsibilities. | Canvas visual and interaction regression. | #658 scope confirmation and Editor visual/browser smoke plan. |
| `js/editor.js` | `EXTRACTION_CANDIDATE` | Large entrypoint/orchestrator that should not absorb detail/canvas responsibilities. | Script loading, initialization, and global contract regression. | #659 should follow or depend on #657/#658 boundary decisions. |
| `modal_compute/app.py` | `AUDIT_NEEDED` | Active Modal backend route shell and service boundary file. | API/Auth/DB/ownership behavior regression. | #660 requires backend contract tests plus Cloudflare/Modal or fixed-slot validation when affected. |
| `js/detail.js` | `EXTRACTION_CANDIDATE` | Detail page runtime mixes fetch, render, action, and loading/error state responsibilities. | Detail loading/action regression. | #661 scope confirmation and Detail browser smoke plan. |
| `js/my-trees.js` | `WATCH_TO_EXTRACTION_CANDIDATE` | Near the large-file threshold and sensitive to Auth/API/browser behavior. | My Trees data/auth/loading/action regression. | #662 requires browser validation and fixed-slot/Cloudflare preview if Auth/API behavior is affected. |

## Execution order

Recommended sequence:

1. #656 docs-only audit PR.
2. #657 Editor detail UI boundary implementation.
3. #658 Editor canvas boundary implementation.
4. #659 Editor entrypoint thin-orchestration implementation.
5. #661 Detail page fetch/render/action split.
6. #662 My Trees runtime module split.
7. #660 Modal API route/service boundary split.

The Modal API item is intentionally last in the default sequence because it touches active backend/API/Auth/DB boundaries and cannot be treated as merge-ready from static checks alone.

## Per-domain guardrails

### Editor

Editor files must not be refactored as one broad Editor rewrite.

Allowed first shapes:

- one detail UI helper family,
- one canvas helper family,
- one entrypoint orchestration boundary,
- no behavior change unless explicitly scoped and browser-verified.

Forbidden combinations:

- `js/editor/editor-detail-ui.js` plus `js/editor/editor-canvas.js` in one large PR,
- Editor runtime plus Modal/API changes,
- Editor JS refactor plus CSS redesign,
- `pages/editor.html` script order changes without `SCRIPT_LOAD_ORDER.md` review,
- PR #7 or prototype/reference/demo/variant changes.

Validation expectation:

- `git diff --check`,
- `npm test`,
- `npm run verify`,
- Editor browser smoke,
- clear evidence for empty/populated/selected/edit states when applicable.

### Detail

`js/detail.js` should be treated as a page-runtime split, not a Browse/Search card or API redesign.

Allowed first shapes:

- fetch helper extraction,
- render helper extraction,
- action handler boundary extraction,
- loading/error state helper extraction.

Forbidden combinations:

- Detail plus Search/Browse renderer changes,
- Detail plus My Trees changes,
- Detail plus API/Auth/backend behavior changes.

Validation expectation:

- `git diff --check`,
- `npm test`,
- `npm run verify`,
- Detail page browser smoke,
- loading/loaded/error/action state evidence where applicable.

### My Trees

`js/my-trees.js` is near the threshold and has Auth/API/browser dependency. It should be split before it grows further, but not as a local-only refactor.

Allowed first shapes:

- list loading helper extraction,
- card rendering helper extraction,
- sort/filter state helper extraction,
- continuation/loading helper extraction,
- action handler helper extraction.

Forbidden combinations:

- My Trees plus Browse/Search changes,
- My Trees plus Detail changes,
- My Trees plus backend/API behavior changes,
- local-only PASS for Auth/API dependent behavior.

Validation expectation:

- `git diff --check`,
- `npm test`,
- `npm run verify`,
- My Trees browser smoke,
- fixed test slot or Cloudflare preview validation if Auth/API behavior is affected.

### Modal backend

`modal_compute/app.py` is active backend runtime. It should proceed only after the frontend refactor sequence is stable or as a separately scheduled backend task with contract coverage.

Allowed first shapes:

- repository/query helper extraction,
- ownership/visibility guard helper extraction,
- serialization helper extraction,
- retry/error helper extraction.

Forbidden combinations:

- route decorator movement without explicit approval,
- API contract changes,
- database schema changes,
- Cloudflare proxy contract changes,
- frontend UI changes in the same PR,
- static-only merge-ready judgment.

Validation expectation:

- backend contract tests,
- `npm test`,
- `npm run verify`,
- Cloudflare/Modal or fixed test slot validation when runtime behavior could be affected,
- PASS and NOT_VERIFIED separated in the PR report.

## Parallelization policy

Audit-only work can run in parallel when it does not mutate the same files.

Implementation work should not run in parallel when it touches the same owner domain or a dependent runtime surface.

Safe or lower-conflict combinations:

- #657 Editor detail UI and #661 Detail page are still both frontend runtime work; avoid if browser verification capacity is limited.
- #661 Detail page and #660 Modal backend can be planned in parallel, but implementation should be scheduled carefully because Detail may depend on API behavior.
- #662 My Trees should not run in parallel with Auth/API/backend changes.

Unsafe combinations:

- #657 and #658 in the same PR,
- #657/#658 and #659 in parallel without coordination,
- #660 with any frontend PR that changes API assumptions,
- #662 with Auth/API changes,
- any implementation PR touching PR #7 or prototype/reference/demo/variant paths.

## Required PR body fields for follow-up implementation PRs

Each follow-up implementation PR should state:

1. Which issue it addresses.
2. Which file and responsibility boundary it changes.
3. Which files are intentionally not changed.
4. Why behavior should remain equivalent.
5. Which validation was completed.
6. Which validation remains NOT_VERIFIED.
7. Whether browser, Cloudflare preview, fixed test slot, or Modal validation was required.
8. Confirmation that PR #7 and prototype/reference/demo/variant paths were not touched.

## Non-goals for #656

This document and its PR do not:

- refactor runtime code,
- create helper modules,
- move files,
- change script loading,
- alter API behavior,
- alter Auth behavior,
- alter CSS cascade or visual design,
- change package/workflow/config files,
- close implementation issues #657 through #662.

## Acceptance criteria for #656

- The large runtime refactor boundary map is recorded.
- Each candidate has a dedicated issue.
- Follow-up PR order is explicit.
- Validation requirements are separated by domain.
- Runtime-sensitive surfaces are not marked merge-ready from static checks alone.
- No code, runtime, UI, backend, package, workflow, or config behavior changes occur in the docs PR.
