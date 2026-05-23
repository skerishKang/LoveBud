# Runtime files over 500 lines audit refresh

Date: 2026-05-23
Branch: `docs/issue-1505-canvas-first-plan`
Base branch: `main`
Base SHA: `e49198e0f14216bf47ce64c230c8436eb0dadd4d`
Related issue: #1505

## Scope

This refresh updates the oversized frontend runtime audit for the current `main` branch. The goal is not to force every file under 500 lines. The goal is to identify large frontend files where too many responsibilities are mixed, then handle them through small, verifiable slices.

Target areas:

- `js/**/*.js`
- `css/**/*.css`
- `pages/**/*.html`

Excluded areas:

- `docs/**`
- `tests/**`
- prototype, reference, demo, and variant material
- backend, API, database, and schema work

## Method

This pass uses the prior audit baseline plus GitHub API line probes against current `main`. A full local census should still be run before each implementation slice:

```bash
find js css pages -type f \( -name '*.js' -o -name '*.css' -o -name '*.html' \) -print0 \
  | xargs -0 wc -l \
  | sort -nr \
  | awk '$1 >= 500 { print }'
```

## Current verified 500+ candidates

| Path | Lines | Type | Risk | Current role | Recommendation |
|---|---:|---|---|---|---|
| `js/editor/editor-canvas.js` | 1,154 | JS | High | canvas controller, layout state, node rendering, pan/drag/viewport orchestration, growth affordance, late-load bridge | Canvas-first track, but safety slice first |
| `js/auth.js` | 767 | JS | High | auth bootstrap bridge, cached session bridge, Firebase fallback bridge, login/signup delegates, logout bridge | Audit-only until browser coverage is explicit |
| `js/my-trees/my-trees-ui.js` | 697 | JS | Medium | My Trees card renderer, metrics, batch rendering, scroll continuation, DOM state update | Later candidate |
| `js/editor.js` | 643 | JS | Medium-High | editor entry orchestrator, shell preparation, data loading, canvas/form/action binding | Second controlled target after canvas preflight |
| `js/search/search-preview-renderer.js` | 638 | JS | Medium | Browse/Search preview renderer, flow card renderer, placeholder/loading UI | Renderer helper extraction candidate |
| `css/global.css` | 556 | CSS | Low | shared global tokens, chips, badges, global UI rules | Low-risk style split candidate |
| `js/i18n/i18n-detail.js` | 542 | JS | Low | data-only detail i18n dictionary | Low urgency; low complexity value |

## Current below-threshold checks from previous candidates

| Path | Current status | Notes |
|---|---:|---|
| `js/editor/editor-memory-form.js` | 471 lines | No longer over threshold |
| `js/search/search-ui.js` | below 500 | Reduced by prior Search work |
| `pages/editor.html` | below 500 | Reduced by template extraction |
| `css/intro.css` | below 500 | Previous `css/intro/hero.css` path is not present in current main |
| `css/my-trees.css` | below 500 | Not currently a 500+ CSS target by targeted probe |

## Canvas-first decision

`js/editor/editor-canvas.js` is by far the largest verified runtime file, so it is reasonable to prioritize it. The safe interpretation of canvas-first is not a broad split. It means the next #1505 work should first add a canvas-specific safety map and then extract only one low-risk boundary.

Canvas-first must preserve:

- node render behavior
- branch render behavior
- selection reapply behavior
- pan behavior
- drag behavior
- zoom/recenter/focus behavior
- layout mode behavior
- localStorage layout keys
- growth affordance behavior
- late-load bridge behavior

## Recommended sequence for #1505

1. `js/editor/editor-canvas.js` preflight: document canvas responsibilities and browser smoke checklist.
2. `js/editor/editor-canvas.js` first narrow extraction: pure render wrapper or already-delegated compatibility helper only.
3. `js/editor.js` shell/debug/readiness helper extraction.
4. `js/search/search-preview-renderer.js` pure renderer helper extraction.
5. `js/my-trees/my-trees-ui.js` metrics/card formatter extraction.
6. `js/auth.js` only after auth-specific smoke coverage is explicit.
7. `css/global.css` as a separate style-only slice if visual smoke is available.
8. `js/i18n/i18n-detail.js` only if i18n ownership is being improved.

## Guardrails

- Keep #1505 open while the sequence is active.
- Keep each PR to one responsibility.
- Do not mix feature work with structural cleanup.
- No backend/API/database/schema changes.
- No prototype/reference/demo/variant changes.
- Browser-visible runtime work needs fixed-slot verification with SHA match.
- Each implementation PR needs either contract coverage or a precise browser smoke checklist.

## Next narrow slice

Recommended next slice:

- Issue: #1505
- Target: `js/editor/editor-canvas.js`
- Goal: add canvas responsibility map and smoke checklist first, then use that as the contract for the first implementation split
- PR body: `Refs #1505`
- Forbidden: `pages/editor.html`, `css/**`, auth behavior, API behavior, storage key changes, layout algorithm changes, node drag/pan behavior changes, prototype/reference/demo/variant paths
- Verification for later runtime slice: `npm run lint`, `npm run build`, `npm test`, `npm run verify`; fixed-slot browser smoke with SHA match

## Test status

No tests were run for this audit refresh. This is a docs-only change and does not alter runtime, styles, tests, or build configuration.
