# Editor Entry Orchestrator Reduction Plan

## 1. Base SHA

755c770ccfe1f9dc2d5f1c43b3b6fbb961594780

## 2. Scope

This plan outlines Phase 1 of reducing js/editor.js entry orchestrator responsibility. The goal is to identify safe extraction candidates that can be moved to existing or new helper modules without changing editor runtime behavior.

No JS/CSS/HTML/runtime changes are made in this planning PR. This is docs-only.

## 3. Current editor file map

### Core files:
- js/editor.js: 821 lines (entry orchestrator)
- pages/editor.html: 303 lines (HTML structure)
- css/editor.css: Needs verification

### Helper modules (js/editor/*.js):
- editor-auth-helpers.js: 46 lines
- editor-bindings.js: 117 lines
- editor-canvas-interaction.js: 110 lines
- editor-canvas-layout.js: 54 lines
- editor-canvas-node.js: 35 lines
- editor-canvas-viewport.js: 79 lines
- editor-canvas.js: 813 lines
- editor-data-loader-fallbacks.js: 238 lines
- editor-data-loader.js: 212 lines
- editor-detail-ui.js: 774 lines
- editor-entry-fallbacks.js: 143 lines
- editor-helpers.js: 188 lines
- editor-i18n-refresh.js: 145 lines
- editor-memory-actions.js: 155 lines
- editor-memory-form.js: 613 lines
- editor-page-helpers.js: 95 lines
- editor-rename-ui.js: 82 lines
- editor-root-helpers.js: 115 lines
- editor-save-status.js: 92 lines
- editor-tree-helpers.js: 90 lines

### Tests:
- tests/contracts/editor-api-surface.test.js
- tests/contracts/editor-script-order-contract.test.js

## 4. Current js/editor.js responsibility map

Based on code analysis, js/editor.js currently handles:

- Boot/auth gate: DOMContentLoaded listener, auth readiness, tryStartEditor
- Shell copy / i18n sync: getI18n, shell copy refresh
- Fallback resolver: dataLoaderFallbacks, resolverFallbacks
- Data loading orchestration: startEditor, data loading coordination
- Tree/memory state bridge: currentTreeData, currentTreeMemories management
- Detail UI bridge: createEditorDetailUI call, updateDetailPanel
- Canvas bridge: createEditorCanvas call, refreshMemories
- Form/action bindings: memory actions, memory form, bindings

## 5. Existing helper module inventory

- editor-auth-helpers.js: Auth-related utilities (window.LoveBudEditorAuthHelpers)
- editor-bindings.js: Form and action bindings (window.LoveBudEditorBindings)
- editor-canvas.js: Canvas controller (window.createEditorCanvas)
- editor-data-loader-fallbacks.js: Data loading fallbacks (window.LoveBudEditorDataLoaderFallbacks)
- editor-data-loader.js: Data loading (window.LoveBudEditorDataLoader)
- editor-detail-ui.js: Detail UI controller (window.createEditorDetailUI)
- editor-entry-fallbacks.js: Entry fallbacks (window.LoveBudEditorResolverFallbacks)
- editor-helpers.js: General helpers (window.LoveBudEditorHelpers)
- editor-i18n-refresh.js: I18n refresh logic
- editor-memory-actions.js: Memory actions controller (window.createEditorMemoryActions)
- editor-memory-form.js: Memory form controller (window.createEditorMemoryForm)
- editor-page-helpers.js: Page helpers (window.LoveBudEditorPageHelpers)
- editor-root-helpers.js: Root helpers (window.LoveBudEditorUtils)
- editor-save-status.js: Save status (window.LoveBudEditorSaveStatus)
- editor-tree-helpers.js: Tree helpers (window.LoveBudEditorTreeHelpers)
- Others: Interaction, layout, node, viewport, rename UI

## 6. Window global dependency map

js/editor.js depends on the following window globals (provided by helper modules):

- LoveBudEditorDataLoaderFallbacks (editor-data-loader-fallbacks.js)
- LoveBudEditorResolverFallbacks (editor-entry-fallbacks.js)
- LoveBudEditorUtils (editor-root-helpers.js)
- LoveBudEditorHelpers (editor-helpers.js)
- LoveBudEditorSaveStatus (editor-save-status.js)
- LoveBudEditorPageHelpers (editor-page-helpers.js)
- LoveBudEditorTreeHelpers (editor-tree-helpers.js)
- LoveBudEditorBindings (editor-bindings.js)
- LoveBudEditorDataLoader (editor-data-loader.js)
- LoveBudEditorAuthHelpers (editor-auth-helpers.js)
- LoveBudUI (global UI utilities)
- t (i18n function)
- location (browser location)
- currentTreeData (state)
- apiClient (global API client)
- LoveBudNormalize (normalization utilities)
- currentTreeMemories (state)
- LoveBudCache (caching)
- createEditorDetailUI (editor-detail-ui.js)
- createEditorCanvas (editor-canvas.js)
- createEditorMemoryActions (editor-memory-actions.js)
- createEditorMemoryForm (editor-memory-form.js)
- getConfirmedAuthUser (auth)
- registerOnAuthReady (auth)
- onAuthReady (auth)

## 7. Phase 1 extraction candidates

### 1st priority: Shell copy / entry-only helper extraction

- i18n sync logic (getI18n, shell copy refresh)
- Entry fallback resolution (dataLoaderFallbacks, resolverFallbacks setup)
- Base path utilities (getEditorBasePath)
- Toast warning setup

### 2nd priority: Fallback resolver delegation cleanup

- Inline fallback functions that can be moved to existing fallbacks modules

### No-go: Canvas/detail behavior, auth flow, API payload, visibility update

## 8. Phase 1 no-go areas

- Canvas rendering and interaction logic
- Detail UI rendering and state management
- Auth flow and gate logic
- API payload construction and calls
- Tree/memory visibility updates
- Form submission and validation
- Data loading core logic
- State bridge mutations
- Any behavior that affects user experience

## 9. Proposed first implementation PR scope

### Allowed files:
- js/editor.js (entry orchestrator reduction only)
- js/editor/editor-entry-fallbacks.js (if extending)
- js/editor/editor-helpers.js (if extending for i18n)
- New file: js/editor/editor-shell-helpers.js (if needed for shell copy)

### Forbidden files:
- pages/editor.html
- css/editor.css
- js/auth.js
- js/postgres-client.js
- js/editor/editor-canvas.js
- js/editor/editor-detail-ui.js
- js/editor/editor-data-loader.js
- js/editor/editor-memory-actions.js
- js/editor/editor-memory-form.js
- Any other js/editor/*.js not listed above
- Tests (new or modified)

## 10. Required contract tests

- tests/contracts/editor-script-order-contract.test.js (script loading order)
- tests/contracts/editor-api-surface.test.js (API surface availability)

These must pass after any extraction.

## 11. Required browser smoke

- Load editor page
- Authenticate user
- Load existing tree with memories
- Create new memory
- Edit memory title and content
- Save changes
- Change tree visibility
- Refresh page and verify state persistence
- Test error scenarios (network failure, auth expiry)

## 12. Risk and rollback plan

### Risks:
- Extraction errors causing missing globals or broken initialization
- I18n sync failures
- Fallback resolution failures

### Rollback:
- If smoke fails, revert the implementation PR immediately
- Restore js/editor.js to pre-extraction state
- Re-run smoke to confirm rollback success

## 13. Explicit non-goals

- No editor runtime behavior changes
- No HTML/CSS changes
- No auth flow changes
- No API contract changes
- No canvas/detail UI changes
- No fallback deletion
- No type="module" conversion
- No file moving or renaming
- No prototype/reference/demo/variant changes
- No test additions or modifications in this plan