# Editor Orchestrator Residual Audit for #1698

**Status:** Active audit  
**Owner:** CTO / Engineering Lead  
**Related issue:** #1698  
**Reference main SHA:** `572e4af4ca50d861eaaa71384df302f236499d17`  
**Audited file:** `js/editor.js`

This audit maps the remaining responsibilities inside `js/editor.js` after the Editor shell helper contract coverage pass and the Editor browser smoke checklist. It is intentionally docs-only and does not authorize runtime behavior changes.

---

## 1. Current file shape

`js/editor.js` remains the classic browser entrypoint for the authenticated Editor page. It is still responsible for the full `DOMContentLoaded` startup path:

```text
DOMContentLoaded wrapper
  -> fallback/global helper resolution
  -> auth/session gate
  -> startEditor()
  -> DOM refs + URL params
  -> shell prep/editability state
  -> initial tree load
  -> memory load + normalization
  -> selected tree/current memory state
  -> detail UI creation
  -> canvas creation and init
  -> memory actions creation
  -> memory form creation
  -> sidebar/detail/empty-guide event binding
  -> final initCanvas/update readiness
```

The file has improved helper coverage, but the orchestration body still combines startup sequencing, dependency waiting, state handoff, module factory wiring, and event binding in one closure.

---

## 2. Residual responsibility buckets

| Bucket | Current location/pattern | Risk | Recommended handling |
| --- | --- | --- | --- |
| Root helper fallbacks | local wrappers for root memory/id checks and YouTube input error fallback | Low-medium | Candidate for contract-backed fallback removal only if `LoveBudEditorUtils` load order is proven stable |
| Shell/core fallback resolution | `shellHelpers`, `entryFallbacks`, `resolverFallbacks`, shell copy, debug, startup waiter | Low | Mostly covered; avoid more movement unless it removes duplicated fallback logic |
| Auth start gate | `tryStartEditor`, `registerOnAuthReady`, cached auth fallback | Medium-high | Do not extract before browser smoke is available for auth gate |
| DOM refs and URL param prep | `createEditorDomRefs`, `URLSearchParams`, `canEdit` | Low | Safe future code slice candidate if covered by contract and no script order change |
| Initial tree load error handling | `loadInitialEditorTree`, authRequired redirect, tree load error copy/render | Medium | Already partially delegated; avoid broad changes |
| Memory load and normalization | `createNormalizeMemory`, `loadEditorMemories`, cache key setup | Medium | Keep in entrypoint until data loader behavior has runtime smoke |
| Selection state | `selectedNodeId`, `currentEditingMemory`, `selectNode`, `createInitialMemory` | High | Do not extract as a first runtime slice; tightly coupled to detail/canvas/actions |
| Detail UI factory wiring | large options object passed to `createEditorDetailUI` | Medium-high | Candidate for an options-builder helper only after contract test protects option keys |
| Canvas factory wiring | large options object passed to `createEditorCanvas`, stores DOM instance, destructures `initCanvas` | High | Hold. Do not touch under this narrow step because `editor-canvas.js`, `initCanvas`, and pan/drag lifecycle are protected |
| External refresh bridge | `handleMemoriesUpdated`, `createRefreshMemories`, `window.refreshMemories` | High | Hold; it calls `initCanvas()` and updates detail/sidebar state |
| Memory actions factory wiring | large options object passed to `createEditorMemoryActions` | Medium-high | Possible later options-builder candidate, but needs contract keys first |
| Memory form factory wiring | large options object passed to `createEditorMemoryForm` | Medium-high | Possible later options-builder candidate, but touches create/save/rerender path |
| Page-level event binding | sidebar visibility, create controls, empty start, empty guide, detail buttons | Medium | Best first runtime slice candidate if isolated to one helper that preserves existing calls |
| Final readiness | final `initCanvas`, empty guide update, initial selection, status update, `markEditorReady` | High | Hold until browser smoke is routine |

---

## 3. Safest next runtime slice

The safest next code PR should avoid tree loading, memory loading, selected memory state, canvas initialization, and save/persist behavior.

Recommended next runtime slice:

```text
Extract page-level event binding orchestration into a helper.
```

Possible helper shape:

```text
js/editor/editor-page-event-bindings.js
  window.LoveBudEditorPageEventBindings.bindEditorPageEvents(options)
```

Allowed call groups for the first slice:

```text
sidebar visibility toggle binding
memory create controls binding
detail empty start button binding
empty guide events binding
detail action buttons binding
```

The helper should only preserve the existing `if (canEdit && helper)` / `if (helper)` gates and call the same existing helper methods with the same option keys.

---

## 4. Required contract before runtime extraction

Before moving event binding calls out of `js/editor.js`, add a focused contract test that verifies the new helper:

```text
- calls bindSidebarVisibilityToggle only when canEdit=true and helper exists;
- calls bindMemoryCreateControlsFromDom only when canEdit=true and helper exists;
- calls bindDetailEmptyStartButton only when canEdit=true and helper exists;
- calls bindEmptyGuideEvents when helper exists, independent of canEdit;
- calls bindDetailActionButtons only when canEdit=true and helper exists;
- passes through the same callable references and status/i18n/http helper references;
- does not import backend/auth/API modules;
- exposes a frozen browser global namespace.
```

The first implementation PR should be test-first or test+helper-only. The follow-up PR can replace the local event binding block in `js/editor.js` with the helper call once contract coverage exists.

---

## 5. Forbidden combinations for the next code PR

Do not combine event binding extraction with any of the following:

- `editor-canvas.js` changes;
- `initCanvas` call movement;
- pan/drag lifecycle edits;
- tree load/data loader edits;
- memory selection or current editing memory behavior edits;
- save/update/delete/persist behavior edits;
- Auth/session gate edits;
- API/backend/schema edits;
- public viewer route edits;
- CSS/HTML layout changes.

---

## 6. Verification gate for the next code PR

Minimum static verification:

```text
git diff --check
node --check changed JS files
npm test
npm run verify
```

Required PR contract matrix:

```text
[Editor Entrypoint Contract Gate]
Entrypoint remains classic browser script: YES
pages/editor.html script order changed: NO
Auth/protected-route behavior changed: NO
Selected tree handoff behavior changed: NO
Canvas init behavior changed: NO
Detail panel init behavior changed: NO
Save/update behavior changed: NO
Legacy window globals removed: NO
Runtime files changed:
Static checks: PASS/FAIL/NOT_RUN
Editor browser smoke: PASS/PARTIAL/BLOCKED/NOT_RUN
Private payload exposure: NO
Secret exposure: NO
Final judgment: PASS/PARTIAL/BLOCKED/FAIL
```

For the first helper contract PR, browser smoke can be `NOT_RUN` if `js/editor.js` is not touched. Once the entrypoint callsite changes, use the #1698 Editor browser smoke checklist.

---

## 7. Current recommendation

Proceed in this order:

1. Add `editor-page-event-bindings` contract tests and helper global, without touching `js/editor.js`.
2. In a separate PR, replace the local binding block in `js/editor.js` with one helper call.
3. Run the Editor browser smoke checklist for the entrypoint callsite PR.

This keeps the next code path narrow and avoids protected canvas/data/auth surfaces.
