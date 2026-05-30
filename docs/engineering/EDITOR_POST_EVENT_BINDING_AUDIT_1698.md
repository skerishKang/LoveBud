# Editor Post Event Binding Audit for #1698

**Status:** Active audit  
**Owner:** CTO / Engineering Lead  
**Related issue:** #1698  
**Reference main SHA:** `589b3b4d859d8a4b463da2074d68de8b489cf425`  
**Audited file:** `js/editor.js`

This document records the state after the page-level event binding helper was introduced, wired into `js/editor.js`, and protected by script-order contract coverage.

---

## 1. Completed safe slice

The event binding slice now has three layers of protection:

```text
PR #1881  helper + helper contract
PR #1883  js/editor.js callsite delegation + script load insertion
PR #1884  pages/editor.html script-order contract
```

Current shape:

```text
pages/editor.html
  -> loads js/editor/editor-page-event-bindings.js
  -> loads js/editor.js

js/editor.js
  -> reads window.LoveBudEditorPageEventBindings
  -> calls bindEditorPageEvents({ ... })
  -> keeps canvas initialization and readiness flow in the entrypoint
```

The event binding helper owns only the delegated binding calls. It does not own data loading, auth/session startup, canvas initialization, selected-memory state, save/update/delete behavior, or public viewer behavior.

---

## 2. Current high-risk boundary

The next block after the delegated event binding call is still high risk:

```text
log('Final Canvas Initialization...')
initCanvas()
updateCanvasEmptyGuide()
initialSelection = treeMemories().find(...) || createInitialMemory()
currentEditingMemory = initialSelection, conditionally
updateSidebarStatus()
markEditorReady()
```

This sequence touches canvas initialization, empty-guide state, initial selected-memory state, sidebar status, and page-ready state. It should not be extracted until authenticated Editor browser smoke is available and repeatable.

Do not move any of these in the next runtime PR:

- `initCanvas()`;
- `updateCanvasEmptyGuide()`;
- `initialSelection` calculation;
- `currentEditingMemory` assignment;
- `updateSidebarStatus()`;
- `markEditorReady()`.

---

## 3. Remaining candidate slices

| Candidate | Risk | Current judgment |
| --- | --- | --- |
| Final readiness helper | High | Hold. It contains `initCanvas()` and readiness state. |
| Auth start gate helper | Medium-high | Hold until browser smoke covers login/auth gate. |
| Refresh memories bridge helper | High | Hold. It calls `initCanvas()` and refreshes detail/sidebar state. |
| Canvas factory options builder | High | Hold. It is too close to canvas lifecycle and pan/drag behavior. |
| Memory actions options builder | Medium-high | Possible later, but touches save/update/delete and rerender paths. |
| Memory form options builder | Medium-high | Possible later, but touches create/save/rerender paths. |
| DOM refs + URL param preparation | Low-medium | Safest next test-first candidate if a code slice is needed. |
| Root helper fallback removal | Low-medium | Possible only if `LoveBudEditorUtils` load order and helper coverage are confirmed. |

---

## 4. Recommended next code path

The safest next implementation path is not another runtime rewrite. It should be a test-first helper or audit-only step.

Preferred next test-first candidate:

```text
Extract DOM refs + URL param preparation into a helper contract, without wiring it into js/editor.js yet.
```

Possible helper:

```text
js/editor/editor-startup-context.js
  window.LoveBudEditorStartupContext.createEditorStartupContext(options)
```

Potential contract coverage:

```text
- calls createEditorDomRefs exactly once;
- returns canvas, svg, detailPanel, addBtn;
- reads treeId from URLSearchParams as urlTreeId;
- derives canEdit from readonly !== '1';
- does not import backend/auth/API modules;
- exposes a frozen browser global;
- does not touch canvas lifecycle, memory state, save/update/delete, or auth callbacks.
```

This candidate only wraps startup context gathering. It avoids canvas lifecycle, selected-memory state, data loading, and persistence behavior.

---

## 5. Required browser smoke before any high-risk slice

Before extracting final readiness, auth start gate, refresh bridge, canvas options, memory actions, or memory form wiring, run the Editor browser smoke checklist:

```text
[Editor Browser Smoke - #1698]
Main SHA:
Auth gate: PASS/FAIL
Editor route startup: PASS/FAIL
Script load failures: NONE/PRESENT
Console fatal errors: NONE/PRESENT
Network fatal errors: NONE/PRESENT
Shell copy/i18n: PASS/FAIL
Empty guide event path: PASS/FAIL/NOT_APPLICABLE
Create memory controls: PASS/FAIL/NOT_APPLICABLE
Detail empty start button: PASS/FAIL/NOT_APPLICABLE
Detail action buttons: PASS/FAIL/NOT_APPLICABLE
Canvas init or safe empty state: PASS/FAIL
Pan/drag fatal error: NO/YES/NOT_VERIFIED
Private payload exposure: NO/YES
Secret exposure: NO/YES
Judgment: PASS/PARTIAL/BLOCKED/FAIL
```

If browser smoke is unavailable, continue with contract-only helper preparation or audit-only work rather than wiring another runtime callsite.

---

## 6. Current recommendation

Proceed in this order:

1. Browser smoke for the post-#1883/#1884 Editor page state, if an authenticated test session is available.
2. If smoke is unavailable, add a test-first `editor-startup-context` helper without wiring it into `js/editor.js`.
3. Do not touch `editor-canvas.js`, `initCanvas`, pan/drag lifecycle, auth startup, refresh bridge, memory actions/form wiring, save/update/delete, API/backend/schema, or public viewer route in the next PR.
