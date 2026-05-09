# Editor Entry Fallback Boundary Audit

## Scope

This report is an audit-only follow-up for the editor entry fallback boundary work associated with Issue #223 / #224.

This v2 branch was recreated from the latest `main` after PR #228 became unsuitable for review. PR #228 is closed, non-merged, and currently has zero commits / zero changed files after branch history collapse. This report therefore does not reuse PR #228 or its branch state.

## Guardrails

- Runtime code was not changed.
- HTML, CSS, Auth, API, Search, and Editor behavior were not changed.
- PR #7 and prototype / reference / demo / variant paths are not touched.
- This PR only adds an audit report and a contract test.

## Files audited

- `pages/editor.html`
- `js/editor.js`
- `js/editor/editor-entry-fallbacks.js`
- `js/editor/editor-data-loader-fallbacks.js`
- `js/editor/editor-data-loader.js`
- `js/editor/editor-page-helpers.js`
- `js/editor/editor-auth-helpers.js`
- related `tests/contracts/*` conventions

## Current editor script-order contract

`pages/editor.html` currently loads editor helper scripts before the editor entry script:

1. shared utility scripts:
   - `js/cache-utils.js`
   - `js/utils/normalize.js`
   - `js/utils/path.js`
   - `js/utils/ui.js`
   - `js/utils/media.js`
2. editor UI / canvas / helper scripts:
   - `js/editor/editor-root-helpers.js`
   - `js/editor/editor-canvas-layout.js`
   - `js/editor/editor-canvas-node.js`
   - `js/editor/editor-canvas-interaction.js`
   - `js/editor/editor-canvas-viewport.js`
   - `js/editor/editor-canvas.js`
   - `js/editor/editor-rename-ui.js`
   - `js/editor/editor-detail-ui.js`
   - `js/editor/editor-memory-actions.js`
   - `js/editor/editor-memory-form.js`
   - `js/editor/editor-helpers.js`
   - `js/editor/editor-save-status.js`
   - `js/editor/editor-page-helpers.js`
   - `js/editor/editor-tree-helpers.js`
   - `js/editor/editor-bindings.js`
   - `js/editor/editor-auth-helpers.js`
   - `js/editor/editor-data-loader.js`
   - `js/editor/editor-data-loader-fallbacks.js`
3. entry script:
   - `js/editor.js`
4. scripts that currently appear after the entry script:
   - `js/editor/editor-i18n-refresh.js`
   - Firebase SDK scripts
   - i18n bundles
   - `js/shared-header.js`
   - auth modules
   - `js/auth.js`
   - inline `renderSharedHeader()` call

The current structure depends on classic synchronous script loading plus `DOMContentLoaded`: `js/editor.js` registers its entry work inside a `DOMContentLoaded` listener, while the later i18n / auth / shared-header scripts still load before that listener runs. This is a real contract, but it is fragile if the page later moves to `defer`, `type="module"`, async loading, or if the editor entry starts executing work before `DOMContentLoaded`.

## Current fallback boundaries

### 1. Root helper fallbacks

`js/editor.js` still contains local fallbacks for root-memory helpers when `window.LoveBudEditorUtils` is missing:

- `findRootMemory`
- `getRootId`
- `getCanonicalRootId`
- `isRootMemory`

Boundary status: still inline in the entry script.

Recommended next boundary: keep canonical implementations in `editor-root-helpers.js` and move remaining entry-local fallback factories behind an explicit entry fallback module only after contract coverage is in place.

### 2. Auth cache fallback

`js/editor.js` uses `window.LoveBudEditorAuthHelpers.readConfirmedAuthCache` when present, otherwise keeps an inline localStorage parser fallback.

Boundary status: partially extracted. `editor-auth-helpers.js` exists and loads before `js/editor.js`, but the entry script still carries an inline fallback.

Recommended next boundary: keep the helper as canonical, then either consume an entry fallback factory or remove the inline fallback only after verifying legacy auth timing assumptions.

### 3. Toast fallback

`js/editor.js` has a local fallback for toast degradation to console logging when `window.LoveBudUI.showToast` is not available.

Boundary status: duplicate-capable. `editor-entry-fallbacks.js` already defines `createInlineShowToastFallback`, but that script is not currently loaded by `pages/editor.html`, and `js/editor.js` does not currently read `window.LoveBudEditorEntryFallbacks`.

Recommended next boundary: first mount `editor-entry-fallbacks.js` before `js/editor.js`, then update `js/editor.js` to consume `LoveBudEditorEntryFallbacks` without changing behavior.

### 4. Page / redirect / tree-load error fallbacks

`editor-page-helpers.js` provides canonical implementations for:

- `getEditorBasePath`
- `buildEditorRedirectTarget`
- `redirectToEditorLogin`
- `getMyTreesHref`
- `renderTreeLoadError`

`js/editor.js` still contains local fallback factories for redirect and tree-load error rendering.

Boundary status: partially extracted. Canonical helper exists and loads before the entry script, but inline fallbacks remain in the entry.

Recommended next boundary: use `editor-entry-fallbacks.js` as the temporary fallback boundary, then reduce entry-local fallback code only after the script-order contract test is green.

### 5. Text resolver fallbacks

`js/editor.js` references `window.LoveBudEditorResolverFallbacks` and expects optional factories such as:

- `createInlineTextResolversFallbacks`
- `createInlineMediaResolversFallbacks`

Current gap: no `js/editor/editor-resolver-fallbacks.js` file is currently loaded by `pages/editor.html`, and that file is not present on main. This means the resolver fallback object is currently an empty object in normal runtime, and resolver fallback behavior is still supplied indirectly through `editorHelpers` or undefined fallback paths.

Boundary status: audit gap.

Recommended next boundary: create or avoid a resolver-fallback module in a dedicated implementation PR. Do not mix that with broader editor refactoring.

### 6. Media resolver fallback

`resolveMemoryThumbnail` is selected from `editorHelpers.resolveMemoryThumbnail` or the optional resolver fallback factory.

Boundary status: audit gap, same as text resolver fallbacks.

Recommended next boundary: decide whether media resolver fallback belongs in `editor-helpers.js`, `js/utils/media.js`, or a dedicated `editor-resolver-fallbacks.js`. The decision should be made before modifying `js/editor.js`.

### 7. Data loader fallbacks

`editor-data-loader.js` is the canonical data loader module. `editor-data-loader-fallbacks.js` exists and is explicitly loaded before `js/editor.js`.

Fallback factories currently include:

- `createInlineNormalizeMemoryFallback`
- `createInlineLoadInitialTreeFallback`
- `createInlineLoadEditorMemoriesFallback`
- `createInlineCreateInitialMemoryFallback`
- `createInlineNextMemoryIdFallback`
- `createInlineRefreshMemoriesFallback`

Boundary status: explicitly extracted and mounted.

Recommended next boundary: leave as-is until entry fallback and resolver fallback boundaries are settled. This is currently the cleanest fallback boundary in the editor entry path.

### 8. Save status fallback

`js/editor.js` uses `window.LoveBudEditorSaveStatus` when present and keeps local fallback behavior for formatting and save-status state creation.

Boundary status: partially extracted. `editor-save-status.js` loads before `js/editor.js`, but entry-local fallback code remains.

Recommended next boundary: after entry fallback boundaries are consumed, move remaining save-status fallback responsibilities behind the canonical helper or a narrow fallback factory.

## Risk classification

| Area | Current state | Risk | Recommendation |
| --- | --- | --- | --- |
| Data loader fallbacks | Extracted and mounted | Low | Keep stable for now |
| Page helpers | Extracted but duplicated in entry fallback code | Medium | Consume entry fallback module first |
| Entry fallback module | Exists but not mounted | Medium | Mount before `js/editor.js` in a narrow PR |
| Resolver fallback object | Referenced but not backed by a loaded file | Medium-high | Dedicated resolver-boundary PR |
| i18n/auth timing | Loaded after `js/editor.js`, works via `DOMContentLoaded` | Medium | Do not convert script loading style without a separate contract |
| Root helpers | Canonical helper exists, inline fallback remains | Low-medium | Reduce after entry fallback module is consumed |
| Save status | Helper exists, inline fallback remains | Low-medium | Reduce after entry fallback module is consumed |

## Recommended PR sequence

### PR 1: Mount and consume editor entry fallback module

Allowed scope should be narrow:

- Add `js/editor/editor-entry-fallbacks.js` before `js/editor.js` in `pages/editor.html`.
- Update `js/editor.js` to read `window.LoveBudEditorEntryFallbacks` for existing entry fallback factories.
- Preserve current behavior and warning messages.
- Keep data loader and resolver behavior unchanged.

### PR 2: Resolve resolver fallback boundary

Choose one direction:

- create `js/editor/editor-resolver-fallbacks.js` and mount it before `js/editor.js`, or
- remove the unused resolver fallback object pattern and keep text/media resolvers in existing canonical helper modules.

Do not combine this with canvas, Auth, API, or page-layout work.

### PR 3: Reduce remaining entry-local fallbacks

After PR 1 and PR 2 are stable:

- root helper fallback cleanup
- auth cache fallback cleanup
- save-status fallback cleanup
- small parity tests per extracted boundary

## Added contract test

This audit adds `tests/contracts/editor-script-order-contract.test.js`.

The test fixes the current page contract without changing runtime behavior:

- editor helper scripts must load before `js/editor.js`;
- `editor-data-loader-fallbacks.js` must remain before the editor entry script;
- `editor-entry-fallbacks.js` and `editor-resolver-fallbacks.js` are currently not loaded and are treated as explicit audit gaps;
- i18n / shared-header / auth scripts currently load after `js/editor.js`, preserving the `DOMContentLoaded` timing contract.

## Conclusion

The editor entry file is ready for a staged fallback-boundary refactor, but the next implementation PR should not start by deleting inline fallbacks. The safest path is to first mount and consume the already-existing `editor-entry-fallbacks.js` module, then handle resolver fallback ambiguity separately.
