# Large Runtime File Decomposition Status

- Issue: #656
- Base main SHA: 096af15e96ce96eff418cb6ec7a50d6df13e9a7b

## Audit scope

Current main large runtime files and their decomposition status after Search duplicate renderer cleanup (PR #893).

Files above 500 lines and files between 450-499 lines. Excludes prototype, legacy design variants (gemini-v2, gemini-v3, gpt-v2, v2).

## 500+ line candidates

| File | Lines | Type | Risk |
|---|---|---|---|
| js/auth.js | 759 | JS | HIGH |
| js/editor.js | 729 | JS | HIGH |
| js/editor/editor-canvas.js | 644 | JS | HIGH |
| js/search/search-ui.js | 641 | JS | MEDIUM |
| js/my-trees/my-trees-ui.js | 624 | JS | MEDIUM |
| js/editor/editor-memory-form.js | 613 | JS | MEDIUM |
| js/search/search-preview-renderer.js | 562 | JS | MEDIUM |
| js/i18n/i18n-detail.js | 542 | JS | LOW |
| css/intro/hero.css | 713 | CSS | LOW |
| css/global/header.css | 598 | CSS | LOW |
| css/global.css | 555 | CSS | LOW |
| css/editor/detail-panel.css | 526 | CSS | LOW |

Note: js/search-card-renderer.js (378 lines) was deleted in PR #893 as it was a duplicate of js/search/search-card-renderer.js (413 lines).

## Near-threshold candidates (450-499)

| File | Lines | Type | Risk |
|---|---|---|---|
| css/search/tree-card.css | 487 | CSS | LOW |
| js/auth/auth-login-page.js | 468 | JS | MEDIUM |
| js/auth/auth-firebase.js | 467 | JS | MEDIUM |
| css/login.css | 467 | CSS | LOW |
| css/index.css | 467 | CSS | LOW |
| css/intro/how-to.css | 460 | CSS | LOW |
| js/shared-header.js | 451 | JS | MEDIUM |
| css/index-visual.css | 499 | CSS | LOW |

## Candidate descriptions

### js/auth.js (759 lines)

Orchestrates Firebase auth, session management, login page UI, email auth, Google auth, dropdown rendering, and nav updates. Highest-risk file.

Refs #705 (partially addressed by PR #885). Remaining auth bootstrap boundary work tracked under #656.

### js/editor.js (729 lines)

Editor entrypoint with data loading, canvas initialization, memory management, sidebar rendering, and publication controls. Previously extracted work (PR #884, #655 viewport controls) has started thinning this file.

Refs #659 (entrypoint orchestration boundary audit).

### js/editor/editor-canvas.js (644 lines)

Canvas rendering, node layout, edge drawing, zoom/pan/viewport, and interaction handling. PR #884 added viewport controls as a separate module, but the main canvas file remains large.

### js/search/search-ui.js (641 lines)

Search page orchestrator: controls binding, card rendering, preview panel, mobile toggles, pagination/growing trees.

### js/my-trees/my-trees-ui.js (624 lines)

My Trees page render, tree card generation, dropdown menu, visibility/publish/delete actions, empty state, and mobile responsive handling.

### js/editor/editor-memory-form.js (613 lines)

Memory editor form: title, description, emotion tags, media URL, date, visibility. Includes validation and save logic.

### js/search/search-preview-renderer.js (562 lines)

Preview panel renderer with action buttons, share controls, media display, and tree moment flow.

### js/i18n/i18n-detail.js (542 lines)

Detail page i18n keys. Low risk due to being data-only.

### css/intro/hero.css (713 lines), css/global/header.css (598 lines), css/global.css (555 lines), css/editor/detail-panel.css (526 lines)

Project-specific CSS files. Low risk due to CSS not causing runtime errors.

### css/index-visual.css (499 lines)

CSS for landing page visual. Low risk.

## Risk classification

| Risk | Count | Files |
|---|---|---|
| HIGH | 3 | auth.js, editor.js, editor-canvas.js |
| MEDIUM | 9 | search-ui.js, my-trees-ui.js, editor-memory-form.js, search-preview-renderer.js, auth-login-page.js, auth-firebase.js, shared-header.js, i18n-detail.js (partially JS-driven) |
| LOW | 9 | All CSS files + i18n-detail.js |

## Recommended sequence

1. Continue thinning js/auth.js (auth bootstrap boundary extraction, #656 parent tracker).
2. Continue thinning js/editor.js and js/editor/editor-canvas.js (entrypoint orchestration, #659).
3. Decompose js/search/search-ui.js (Search UI orchestrator split).
4. Decompose js/my-trees/my-trees-ui.js (My Trees UI split).
5. Decompose js/editor/editor-memory-form.js (Memory form split).
6. CSS refactoring can proceed in parallel at any time (low risk).

## NOT_VERIFIED

- No browser verification performed.
- No runtime behavior verification.
- No production verification.
- Line counts measured on current main SHA only.
- Future merges may change line counts.

## Non-action statement

This audit does NOT authorize:
- File moves or splits without separate PR and browser verification.
- Broad JS architecture rewrite.
- ES module or type=module conversion.
- Auth/Editor/My Trees/Search behavior changes without separate PR.
