# Runtime JS files over 500 lines audit (refresh)

Date: 2026-05-05
Branch: `audit/runtime-files-over-500-lines-refresh-656`
Base branch: `main`
Base SHA: `948ac142dd741b83146086f5defae01f464253c1`
Related issues: #223, #224, #656

Previous audit: `docs/reports/RUNTIME_FILES_OVER_500_LINES_AUDIT.md` (2026-04-28, SHA `1dddfa7`)

## Scope

This is a docs-only refresh of the previous audit after auth refactoring (PRs #826, #827) and editor decomposition. No runtime JavaScript, HTML, CSS, tests, prototypes, references, demos, variants, auth providers, login provider flow, fallback code, or editor behavior were changed in this refresh.

## Method and limitation

This audit records current runtime browser JavaScript line-count targets under `js/` against the PR base shown above. It intentionally excludes docs, tests, legacy Netlify functions, prototype/reference/demo/variant files, and non-browser runtime files.

## Summary

### Files over 500 lines

| Path | Lines | Previous audit | Delta | Current role | Recommendation |
|---|---:|---:|---:|---|---|
| `js/search/search-preview-renderer.js` | 718 | Not audited | — | active runtime module / browser preview renderer | Audit candidate |
| `js/auth.js` | 698 | 954 | -256 | auth bootstrap bridge | Audit-only until auth contracts and browser smoke checklist are ready |
| `js/editor.js` | 634 | 1,071 | -437 | editor entry orchestrator | First refactor target |
| `js/editor/editor-memory-form.js` | 530 | Not audited | — | active runtime module / memory form controller | Audit candidate |
| `js/editor/editor-canvas.js` | 527 | 735 | -208 | canvas controller | Still over threshold; refactor later due interaction risk |

### Files 450-499

None in current refresh.

### Previous over-500 files that dropped below threshold

| Path | Previous lines | Current lines | Reason |
|---|---:|---:|---|
| `js/my-trees.js` | 528 | 298 | Dropped below threshold after auth gate extraction and my-trees module decomposition |
| `js/editor/editor-detail-ui.js` | 846 | 385 | Dropped below threshold after detail UI decomposition into sidebar-status-boundary and detail-ui-builders |

### Requested files at or below 500 lines

| Path | Lines | Previous audit | Current role | Recommendation |
|---|---:|---:|---|---|
| `js/my-trees.js` | 298 | 528 | page controller / compatibility bridge | No line-count refactor now |
| `js/editor/editor-detail-ui.js` | 385 | 846 | detail panel renderer bridge | No line-count refactor now |
| `js/settings.js` | 276 | 298 | page controller | Do not refactor now |
| `js/search.js` | 230 | 374 | page orchestrator | Do not refactor now |
| `js/postgres-client.js` | 175 | 224 | API client facade | Do not refactor now |

## Detailed current 500+ audit

## 1. `js/editor.js`

- Line count: 634
- 500-line status: over threshold
- Current role: editor entry orchestrator, page bootstrap, editor auth gate, shell copy synchronizer, data loading coordinator, form/action binder, compatibility bridge
- Refactoring risk: medium
- Recommendation: first refactor target

### Refactoring judgment

This remains the best first target because prior decomposition has already reduced the file from 1,071 to 634 lines. The next step should extract remaining entry-only helper logic without changing runtime behavior.

### First PR scope

Allowed files:

- `js/editor.js`
- existing narrowly scoped editor entry/helper files only if needed
- optional new helper only if named narrowly, e.g. `js/editor/editor-shell-copy.js`

Forbidden files:

- `pages/editor.html`
- `css/**`
- `js/auth.js`
- `js/login/**`
- `js/my-trees.js`
- `js/search.js`
- `js/postgres-client.js`
- prototype/reference/demo/variant files

### Needed verification

- Existing editor entry contract checks remain green.
- Logged-out editor route behavior remains unchanged.
- Logged-in editor opens an owned tree without blank screen.
- Empty tree state renders.
- Existing tree with memories renders canvas and detail panel.
- Add memory form opens/closes.
- Browser console has no new fatal errors.

### Absolute no-go items

- No `type="module"` conversion.
- No editor runtime behavior changes.
- No auth flow changes.
- No API endpoint or payload changes.
- No CSS/HTML changes.
- No fallback deletion in the first runtime PR.

## 2. `js/search/search-preview-renderer.js`

- Line count: 718
- 500-line status: over threshold
- Current role: browser preview renderer / UI builder
- Refactoring risk: medium-high because Browse/Search preview behavior requires real browser verification
- Recommendation: audit candidate after editor entry reduction

### Refactoring judgment

This is now the largest runtime browser JavaScript file in the audit. It should be handled as a Browse/Search UI refactor with fixed-slot browser verification, not as a generic line-count cleanup.

### First PR scope

Allowed files:

- `js/search/search-preview-renderer.js`
- optional narrowly named search preview helper file
- relevant Search/Browse contract tests if needed

Forbidden files:

- `pages/search.html`
- broad search runtime rewrites
- auth files
- editor files
- my-trees files
- CSS/HTML changes unless explicitly scoped in a later UI PR
- prototype/reference/demo/variant files

### Needed verification

- Public Browse/Search list loads.
- Desktop preview hydration works.
- Mobile preview open/close works.
- Sort/filter/search URL state remains unchanged.
- Growing trees fallback behavior remains unchanged.
- Fixed slot + SHA match + real browser verification is required.

### Absolute no-go items

- No URL state behavior changes.
- No API path or payload changes.
- No preview cache behavior changes.
- No Browse/Search behavior PASS from text-only or local-only checks.

## 3. `js/editor/editor-memory-form.js`

- Line count: 530
- 500-line status: over threshold
- Current role: active runtime module / memory form controller
- Refactoring risk: medium-high because it affects editor moment creation
- Recommendation: audit candidate after editor entry reduction

### Refactoring judgment

The file is just over threshold and directly touches memory creation UX. Any split should be helper-only and preserve parent selection, URL validation, fallback local save mode, canvas refresh, and detail/sidebar update behavior.

### First PR scope

Allowed files:

- `js/editor/editor-memory-form.js`
- optional narrowly named helper file for pure validation or form state utilities
- relevant editor form contract tests if needed

Forbidden files:

- `pages/editor.html`
- `css/**`
- `js/auth.js`
- `js/editor.js` unless the PR is explicitly coordinated with entry wiring
- API client files
- prototype/reference/demo/variant files

### Needed verification

- Add memory form opens/closes.
- YouTube URL validation remains unchanged.
- Parent memory selection remains unchanged.
- First moment creation still works.
- Non-root child moment creation still works.
- Canvas and detail/sidebar refresh after creation.
- Browser console has no new fatal errors.

### Absolute no-go items

- No API payload changes.
- No parent/root resolution changes.
- No local save fallback deletion.
- No CSS/HTML changes.

## 4. `js/editor/editor-canvas.js`

- Line count: 527
- 500-line status: over threshold
- Current role: active runtime module, editor canvas controller, layout state, node rendering, drag/pan/viewport orchestration, growth affordance renderer
- Refactoring risk: high
- Recommendation: refactor later due interaction risk

### Refactoring judgment

This file remains above threshold after the current decomposition. It should not be first because it owns behavior-sensitive canvas interactions: panning, dragging, viewport persistence, node rendering, fallback paths, and growth affordance.

### First PR scope

Allowed files:

- `js/editor/editor-canvas.js`
- optional new helper only for pure rendering, e.g. `js/editor/editor-canvas-affordance.js`

Forbidden files:

- `pages/editor.html`
- `css/editor.css`
- `js/editor.js`
- `js/editor/editor-detail-ui.js`
- API/auth files
- prototype/reference/demo/variant files

### Needed verification

- Existing tree renders nodes.
- Branches render.
- Dragging node persists position.
- Canvas pan works.
- Recenter works.
- Focus selected works.
- Growth affordance opens add memory form.
- Mobile viewport has no blank canvas regression.

### Absolute no-go items

- No layout algorithm change in first PR.
- No localStorage key change.
- No SVG path behavior change.
- No node drag/pan behavior change.
- No CSS/HTML changes.

## 5. `js/auth.js`

- Line count: 698
- 500-line status: over threshold
- Current role: auth bootstrap bridge, login-page delegation bridge, cached-auth bridge, Firebase auth fallback bridge, nav UI bridge
- Refactoring risk: high
- Recommendation: audit-only until auth contract and browser smoke coverage are explicit

### Refactoring judgment

This file remains oversized, but it is not the best first implementation target. It sits on login/logout/protected-route critical paths and requires strict auth regression protection.

### First PR scope

Allowed files for a later auth-only PR:

- `js/auth.js`
- existing `js/auth/*.js` only if the PR is pure compatibility extraction
- relevant auth contract tests under `tests/contracts/`

Forbidden files:

- `pages/login.html`
- `js/login/**` unless the PR is explicitly login bridge only
- `js/editor.js`
- `js/my-trees.js`
- `js/postgres-client.js`
- Firebase provider changes
- auth provider switching
- CSS/HTML changes
- prototype/reference/demo/variant files

### Needed verification

- Auth bootstrap readiness still resolves once.
- Login page opens in login mode.
- Login page opens in signup mode.
- Email login/signup modal works as before.
- Google login button wiring remains intact.
- Logged-out protected pages redirect.
- Logged-in navigation dropdown renders.
- Logout clears confirmed auth cache and redirects.
- Firebase unavailable/offline path does not create stale clickable auth UI.

### Absolute no-go items

- No provider transition.
- No login page behavior changes.
- No fallback deletion without contract parity proof.
- No protected-route policy changes.
- No Firebase config changes.
- No broad auth refactor combined with UI/CSS work.

## Below-threshold notes

## `js/editor/editor-detail-ui.js`

- Line count: 385
- 500-line status: not over threshold
- Current role: detail panel renderer bridge
- Recommendation: no line-count refactor now

## `js/my-trees.js`

- Line count: 298
- 500-line status: not over threshold
- Current role: page controller / compatibility bridge
- Recommendation: no line-count refactor now

## `js/search.js`

- Line count: 230
- 500-line status: not over threshold
- Current role: search page orchestrator
- Recommendation: no line-count refactor now

## `js/settings.js`

- Line count: 276
- 500-line status: not over threshold
- Current role: settings page controller
- Recommendation: no refactor now

## `js/postgres-client.js`

- Line count: 175
- 500-line status: not over threshold
- Current role: active browser API client facade for same-origin `/api/*`
- Recommendation: no refactor now

## Recommended refactoring order

1. `js/editor.js` entry orchestrator reduction
2. `js/search/search-preview-renderer.js` preview renderer helper extraction
3. `js/editor/editor-memory-form.js` memory form helper extraction
4. `js/editor/editor-canvas.js` canvas helper extraction after interaction smoke coverage is ready
5. `js/auth.js` only after auth contracts and fixed-slot browser smoke checklist are explicitly ready

## Directly refactorable now

- `js/editor.js`

## Audit candidates after editor entry reduction

- `js/search/search-preview-renderer.js`
- `js/editor/editor-memory-form.js`
- `js/editor/editor-canvas.js`

## Audit-only for now

- `js/auth.js`
- `js/editor/editor-detail-ui.js`
- `js/my-trees.js`
- `js/search.js`
- `js/settings.js`
- `js/postgres-client.js`

## Global absolute no-go list

- No direct `main` modification.
- No direct `main` push.
- No merge.
- No PR #7 / prototype / reference / demo / variant changes.
- No code movement in this audit PR.
- No fallback deletion in this audit PR.
- No auth/login/provider transition.
- No editor runtime behavior change.
- No Browse/Search behavior change.
- No CSS/HTML modification.
- No `type="module"` conversion.
- No Jest introduction.
- No API path or payload change.
- Browse/Search/Editor/My Trees/Auth verification must use fixed slot + SHA match + real browser when runtime work is introduced later.

## Test status

No tests were run. This PR is docs-only and introduces no runtime or test code changes. Per task instruction, `npm test` is not required for docs-only audit output.
