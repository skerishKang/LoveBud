# Runtime JS files over 500 lines audit

Date: 2026-04-28
Branch: `audit/runtime-files-over-500-lines`
Base branch: `main`
Base SHA: `1dddfa7633445ac10e2851b5794a55ab85c9dad2`
Related issues: #223, #224

## Scope

This is a pre-refactor audit only. No runtime JavaScript, HTML, CSS, tests, prototypes, references, demos, variants, auth providers, login provider flow, fallback code, or editor behavior were changed.

Primary requested files:

- `js/auth.js`
- `js/editor.js`
- `js/my-trees.js`
- `js/search.js`
- `js/settings.js`
- `js/postgres-client.js`

Additional `js/**/*.js` files found during the audit and included because they exceed the 500-line threshold:

- `js/editor/editor-canvas.js`
- `js/editor/editor-detail-ui.js`

## Method and limitation

The audit was performed against current GitHub `main` using the GitHub connector. Local `git clone` / `wc -l` could not be used in this execution environment because external DNS resolution for `github.com` failed. The line counts below are normalized logical line counts from fetched GitHub file contents. CRLF/LF differences may change counts by zero lines only; threshold classification is unaffected.

Because the repository contains many docs and legacy artifacts, this audit focuses on runtime browser JavaScript under `js/`, not docs, tests, Netlify legacy functions, prototypes, reference/demo/variant files, or server-side runtime files.

## Summary

### Files over 500 lines

| Path | Lines | Over 500 | Current role | Recommendation |
|---|---:|:---:|---|---|
| `js/editor.js` | 1,071 | Yes | entry orchestrator / compatibility-heavy page bootstrap | Refactor first |
| `js/auth.js` | 954 | Yes | compatibility shim + auth bootstrap bridge | Audit-only until contract/smoke guard is explicit |
| `js/editor/editor-detail-ui.js` | 846 | Yes | active runtime module / DOM renderer | Refactor after editor entry reduction |
| `js/editor/editor-canvas.js` | 735 | Yes | active runtime module / canvas controller | Refactor after detail UI split |
| `js/my-trees.js` | 528 | Yes | page controller / compatibility bridge | Refactor later, after active parallel my-trees work settles |

### Requested files at or below 500 lines

| Path | Lines | Over 500 | Current role | Recommendation |
|---|---:|:---:|---|---|
| `js/search.js` | 374 | No | page orchestrator | Do not refactor for line count now |
| `js/settings.js` | 298 | No | page controller | Do not refactor now |
| `js/postgres-client.js` | 224 | No | active runtime API client facade | Do not refactor now |

### Additional checked runtime candidates under `js/`

| Path | Lines | Over 500 | Notes |
|---|---:|:---:|---|
| `js/editor/editor-data-loader-fallbacks.js` | 283 | No | Extracted fallback helper; not a current 500-line target |

## Detailed file audit

## 1. `js/editor.js`

- Line count: 1,071
- 500-line status: over threshold
- Current role: entry orchestrator, page bootstrap, editor auth gate, editor shell copy synchronizer, data loading coordinator, form/action binder, compatibility fallback bridge
- Refactoring risk: medium-high
- Recommendation: yes, first refactor target

### Window globals / dependencies

Observed dependency surface includes:

- `window.LoveBudEditorDataLoaderFallbacks`
- `window.LoveBudEditorResolverFallbacks`
- `window.LoveBudEditorUtils`
- `window.LoveBudEditorHelpers`
- `window.LoveBudEditorSaveStatus`
- `window.LoveBudEditorPageHelpers`
- `window.LoveBudEditorTreeHelpers`
- `window.LoveBudEditorBindings`
- `window.LoveBudEditorDataLoader`
- `window.LoveBudEditorAuthHelpers`
- `window.LoveBudNormalize`
- `window.LoveBudCache`
- `window.apiClient`
- `window.createEditorDetailUI`
- `window.createEditorCanvas`
- `window.t`
- `window.currentTreeData`
- `window.currentTreeMemories`

### Refactoring judgment

This is the safest first target because it is already structured as an orchestrator that delegates to extracted editor modules. The first refactor should move remaining entry-only helper logic without changing runtime behavior.

### First PR scope

Allowed files:

- `js/editor.js`
- `js/editor/editor-entry-fallbacks.js`
- `js/editor/editor-page-helpers.js`
- optional new file only if named narrowly, e.g. `js/editor/editor-shell-copy.js`

Forbidden files:

- `pages/editor.html`
- `css/**`
- `js/auth.js`
- `js/login/**`
- `js/my-trees.js`
- `js/search.js`
- `js/postgres-client.js`
- prototype/reference/demo/variant files

First PR should only extract shell copy and entry fallback helper code. It must not alter editor behavior, auth gating, API payloads, memory creation, visibility update behavior, canvas behavior, or script type.

### Needed contract tests

- Existing editor entry namespace availability check, or add a no-runtime-change contract test that verifies required editor globals are defined before `js/editor.js` uses them.
- Verify fallback factories remain available on `window.LoveBudEditorDataLoaderFallbacks` and `window.LoveBudEditorResolverFallbacks`.
- Verify `window.currentTreeData` / `window.currentTreeMemories` compatibility names remain unchanged.

### Needed browser smoke

- Logged-out direct load of `/pages/editor.html` redirects to login or remains protected per current behavior.
- Logged-in load of `/pages/editor.html?treeId=<owned-tree>` opens without blank screen.
- Empty tree state renders.
- Existing tree with memories renders canvas and detail panel.
- Add memory form opens/closes.
- Visibility toggle still calls existing API path.
- Browser console has no new fatal errors.

### Absolute no-go items

- No `type="module"` conversion.
- No editor runtime behavior changes.
- No auth flow changes.
- No API endpoint or payload changes.
- No CSS/HTML changes.
- No deletion of fallback code in the first PR.

## 2. `js/auth.js`

- Line count: 954
- 500-line status: over threshold
- Current role: compatibility shim, auth bootstrap bridge, login-page delegation bridge, cached-auth bridge, Firebase auth fallback bridge, nav UI bridge
- Refactoring risk: high
- Recommendation: do not implement first; audit-only until auth-specific contract/smoke coverage is confirmed

### Window globals / dependencies

Observed dependency surface includes:

- `window.LoveBudAuthState`
- `window.LoveBudAuthUI`
- `window.LoveBudAuthSession`
- `window.LoveBudAuthFirebase`
- `window.LoveBudAuthBootstrap`
- `window.LoveBudAuthCallbacks`
- `window.LoveBudAuthCache`
- `window.LoveBudAuthLoginPage`
- `window.LoveBudLoginPageController`
- `window.__initialAuthMode`
- `window.__onAuthReadyCallbacks`
- `window.__lastAuthUser`
- `window.getBasePath`
- `window.registerOnAuthReady`
- `window.applyI18n`
- `window.apiClient`
- `firebase`
- `initFirebase`

### Refactoring judgment

This file is oversized, but it is not the best first implementation target. It sits on the login/logout/protected-route critical path and still contains compatibility fallbacks. Removing or moving code before contract tests can create subtle auth regressions.

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

### Needed contract tests

- Auth bootstrap `whenReady()` resolves exactly once.
- `registerOnAuthReady()` preserves callback behavior before and after auth ready.
- Confirmed auth cache read/write/clear semantics remain unchanged.
- Offline fallback behavior remains unchanged.
- Login page email mode delegation remains unchanged.

### Needed browser smoke

- Login page opens in login mode.
- Login page opens in signup mode.
- Google login button wiring remains intact.
- Email login/signup modal works as before.
- Logged-out protected pages redirect.
- Logged-in navigation dropdown renders.
- Logout clears confirmed auth cache and redirects.
- Firebase unavailable/offline path does not create clickable stale auth UI.

### Absolute no-go items

- No provider transition.
- No login page behavior changes.
- No fallback deletion without contract parity proof.
- No protected-route policy changes.
- No Firebase config changes.
- No broad auth refactor combined with UI/CSS work.

## 3. `js/editor/editor-detail-ui.js`

- Line count: 846
- 500-line status: over threshold
- Current role: active runtime module, detail panel DOM renderer, inline edit UI builder, tree meta block renderer, share/detail action binder
- Refactoring risk: medium-high
- Recommendation: yes, but after `js/editor.js` entry reduction

### Window globals / dependencies

Observed dependency surface includes:

- `window.t` through injected `i18n`
- `window.currentTreeData` indirectly through injected `getCurrentTreeData`
- `navigator.clipboard`
- DOM ids in `pages/editor.html`, including detail panel, edit fields, save indicator, tree meta mount, memory action controls
- injected callbacks: `updateTreeVisibility`, `openCurrentMomentDetail`, `focusSelectedMoment`, `updateSelectedMemoryFields`

### Refactoring judgment

The module is large because it mixes renderer construction, inline styles, edit mode state, share action binding, and detail-panel state transitions. It is refactorable, but it is an active runtime module, not a compatibility shim. First split should be internal helper extraction, not behavior change.

### First PR scope

Allowed files:

- `js/editor/editor-detail-ui.js`
- optional new file: `js/editor/editor-detail-ui-builders.js` or `js/editor/editor-detail-actions.js`

Forbidden files:

- `pages/editor.html`
- `css/editor.css`
- `js/editor.js`
- API client files
- auth files

### Needed contract tests

- `createEditorDetailUI()` returns the same public methods: `setDetailEmptyState`, `updateFocusSelectedBtn`, `updateSidebarStatus`, `updateDetailPanel`.
- Required callback names and dependency keys remain unchanged.

### Needed browser smoke

- Selecting a memory updates detail panel.
- Inline title edit saves/cancels.
- Inline memo edit saves/cancels.
- Share link button still copies expected detail URL.
- Open detail button navigates to detail page.
- Empty state remains unchanged.

### Absolute no-go items

- No CSS extraction in the first runtime PR.
- No DOM id changes.
- No copy/i18n key changes.
- No visibility or share behavior changes.

## 4. `js/editor/editor-canvas.js`

- Line count: 735
- 500-line status: over threshold
- Current role: active runtime module, editor canvas controller, layout state, node rendering, drag/pan/viewport orchestration, growth affordance renderer
- Refactoring risk: high
- Recommendation: refactor later, after detail UI split

### Window globals / dependencies

Observed dependency surface includes:

- `window.currentTreeData`
- `window.LoveBudEditorCanvasLayout`
- `window.LoveBudEditorCanvasNode`
- `window.LoveBudEditorCanvasInteraction`
- `window.LoveBudEditorCanvasViewport`
- `window.LoveBudUI`
- `window.t`
- DOM ids for canvas, SVG, viewport controls, add memory controls, and memory nodes
- localStorage layout key `lovebud_tree_layout_v2_<treeId>`

### Refactoring judgment

This file is large and behavior-sensitive. It owns panning, dragging, viewport persistence, node rendering, fallback paths, and growth affordance. It is refactorable, but should not be first because visual/interaction regressions are likely.

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

### Needed contract tests

- `createEditorCanvas()` public return shape remains unchanged.
- `focusNodeById`, `recenterViewport`, `calcPosition`, `drawBranch`, `drawNode`, `initCanvas` remain callable if currently exported.
- Layout localStorage key remains unchanged.

### Needed browser smoke

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

## 5. `js/my-trees.js`

- Line count: 528
- 500-line status: over threshold
- Current role: page controller, compatibility bridge, auth boot, list render fallback, card menu fallback, action delegation
- Refactoring risk: medium
- Recommendation: refactor later, not before editor entry reduction

### Window globals / dependencies

Observed dependency surface includes:

- `window.LoveBudMyTreesUI`
- `window.LoveBudMyTreesActions`
- `window.LoveBudMyTreesData`
- `window.LoveBudMyTreesState`
- `window.LoveBudMyTreesPage`
- `window.LoveBudUI`
- `window.LoveBudNormalize`
- `window.LoveBudAuthBootstrap`
- `window.registerOnAuthReady`
- `window.getConfirmedAuthUser`
- `window.t`

### Refactoring judgment

This file has already been partially decomposed into `js/my-trees/*`. Remaining large sections are legacy fallback rendering and page boot wiring. It is safe to refactor after current my-trees parallel work settles, but should not be combined with editor or auth work.

### First PR scope

Allowed files:

- `js/my-trees.js`
- `js/my-trees/my-trees-page.js`
- optional existing `js/my-trees/my-trees-ui.js` only if moving pure render helpers

Forbidden files:

- `pages/my-trees.html`
- `css/**`
- `js/auth.js`
- `js/editor.js`
- `js/search.js`
- `js/my-trees/my-trees-actions.js` unless action delegation is the only explicit scope

### Needed contract tests

- My Trees page namespace availability.
- Header create button still delegates to `createNewTree`.
- Retry button still delegates to `loadTrees`.
- Auth bootstrap cached-user path remains unchanged.

### Needed browser smoke

- Logged-out direct load redirects to login.
- Logged-in load shows tree list.
- Empty state shows create CTA.
- Create tree redirects to editor.
- Card click opens editor.
- Card menu visibility/rename/delete still works.

### Absolute no-go items

- No visibility policy change.
- No default visibility change.
- No my-trees action behavior change.
- No CSS/HTML change.

## Below-threshold requested files

## `js/search.js`

- Line count: 374
- 500-line status: not over threshold
- Current role: search page orchestrator
- Refactoring risk: medium
- Recommendation: no line-count refactor now
- Reason: It already delegates to search UI, card renderer, preview renderer, preview cache, URL state, and adapter modules. Refactoring now would risk Browse regressions without solving the 500-line target.

Needed smoke if touched later:

- Public browse list loads.
- Search input filters.
- Tag chips filter.
- Sort/limit controls preserve URL state.
- Desktop preview hydration works.
- Mobile preview open/close works.
- Growing trees section handles API failure gracefully.

## `js/settings.js`

- Line count: 298
- 500-line status: not over threshold
- Current role: settings page controller
- Refactoring risk: low-medium
- Recommendation: no refactor now
- Reason: Below threshold and narrow page controller. Only touch when settings product behavior changes.

## `js/postgres-client.js`

- Line count: 224
- 500-line status: not over threshold
- Current role: active browser API client facade for same-origin `/api/*`
- Refactoring risk: medium-high despite size
- Recommendation: no refactor now
- Reason: Small enough and central to API behavior. It should not be modified during a line-count cleanup.

## Recommended refactoring order

1. `js/editor.js` entry orchestrator reduction
2. `js/editor/editor-detail-ui.js` detail renderer helper extraction
3. `js/editor/editor-canvas.js` canvas affordance/helper extraction
4. `js/my-trees.js` legacy fallback/page bridge reduction
5. `js/auth.js` only after auth contracts and browser smoke checklist are explicitly ready

## Directly refactorable now

- `js/editor.js`

Potentially refactorable after current parallel work is checked:

- `js/my-trees.js`
- `js/editor/editor-detail-ui.js`

## Audit-only for now

- `js/auth.js`
- `js/editor/editor-canvas.js`
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
- No CSS/HTML modification.
- No `type="module"` conversion.
- No Jest introduction.
- No API path or payload change.

## Test status

No tests were run. This PR is docs-only and introduces no runtime or test code changes. Per task instruction, `npm test` is not required for docs-only audit output.
