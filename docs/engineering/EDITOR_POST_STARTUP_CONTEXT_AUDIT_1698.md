# Editor Post Startup Context Audit for #1698

**Status:** Active audit  
**Owner:** CTO / Engineering Lead  
**Related issue:** #1698  
**Reference main SHA:** `7877e75eb7f45bf3e817b5553539ab97f3f6a051`  
**Audited file:** `js/editor.js`

This audit records the state after the startup context helper was introduced, wired into `js/editor.js`, and protected by script-order contract coverage.

---

## 1. Completed startup-context slice

The startup context slice now has two stages:

```text
PR #1886  helper + helper contract
PR #1887  js/editor.js callsite delegation + script load insertion
```

Current shape:

```text
pages/editor.html
  -> loads js/editor/editor-dom-refs-builder.js
  -> loads js/editor/editor-startup-context.js
  -> loads js/editor.js

js/editor.js
  -> reads window.LoveBudEditorStartupContext
  -> calls createEditorStartupContext({ createEditorDomRefs, locationRef, URLSearchParamsRef })
  -> receives canvas, svg, detailPanel, addBtn, urlTreeId, canEdit
```

The inline DOM refs and URL parameter parsing block has been delegated. The entrypoint still owns the broader startup sequence.

---

## 2. Verification and record-quality notes

PR #1887 landed the intended implementation and updated relevant contract boundaries. The runtime changed files were:

```text
js/editor.js
pages/editor.html
```

Contract updates were limited to editor startup/dom-ref/editability boundaries.

Caution: PR #1887 merged with `Final judgment: PENDING` still present in the PR body. That does not invalidate the code change, but future PRs should update the Contract Gate to `Final judgment: PASS` before merge when checks are green.

---

## 3. Current high-risk boundaries

The following areas should remain on hold without authenticated Editor browser smoke:

| Boundary | Why it is risky |
| --- | --- |
| `initCanvas()` and final readiness | Tied to canvas lifecycle, empty guide state, selection, sidebar status, and page readiness. |
| `createEditorCanvas(...)` options | Carries rendering, positioning, focus, draw, branch, and canvas callbacks. |
| `handleMemoriesUpdated` / `window.refreshMemories` | Refreshes memory data and calls `initCanvas()`. |
| `createEditorMemoryActions(...)` wiring | Touches save/update/delete, local save mode, cache, rerender, and focus paths. |
| `createEditorMemoryForm(...)` wiring | Touches create flow, parent resolution, save status, cache, and canvas rerender. |
| Selected/current memory state | Coupled to detail panel, canvas selection, and initial state. |
| Auth start gate | Depends on protected route state, cached auth fallback, and redirect behavior. |
| Data loader wiring | Loads initial tree and memories, handles auth-required/tree-not-found states. |

Do not combine any of these with another runtime extraction.

---

## 4. Safer remaining candidates

The remaining low-risk options are now narrower than before.

| Candidate | Current judgment |
| --- | --- |
| Audit-only browser smoke readiness | Safest. Use before any high-risk runtime extraction. |
| Script-order contract refinements | Safe when changing helper load order. Not needed unless another helper is wired. |
| Test-first shell/status helper | Possible if it does not touch canvas, auth, memory state, or persistence. |
| Root helper fallback removal | Possible only if root utility load order and fallback coverage are first confirmed. |
| Final readiness helper | Hold. Too close to `initCanvas()`. |
| Canvas split | Hold until browser smoke is repeatable. |

---

## 5. Recommended next step

The next best step is not another runtime extraction. Choose one:

1. Run authenticated Editor browser smoke for the post-#1887 state.
2. If browser smoke is unavailable, perform an audit-only pass on the remaining `js/editor.js` helper fallbacks and identify whether any fallback can be removed with contract protection.
3. If code is necessary, use test-first only and avoid wiring into `js/editor.js` until contract coverage exists.

Recommended browser smoke template:

```text
[Editor Browser Smoke - #1698 post-startup-context]
Main SHA: 7877e75eb7f45bf3e817b5553539ab97f3f6a051
Auth gate: PASS/FAIL
Editor route startup: PASS/FAIL
Script load failures: NONE/PRESENT
Console fatal errors: NONE/PRESENT
Network fatal errors: NONE/PRESENT
Shell copy/i18n: PASS/FAIL
Startup context path: PASS/FAIL
Empty guide event path: PASS/FAIL/NOT_APPLICABLE
Create memory controls: PASS/FAIL/NOT_APPLICABLE
Detail action buttons: PASS/FAIL/NOT_APPLICABLE
Canvas init or safe empty state: PASS/FAIL
Pan/drag fatal error: NO/YES/NOT_VERIFIED
Private payload exposure: NO/YES
Secret exposure: NO/YES
Judgment: PASS/PARTIAL/BLOCKED/FAIL
```

---

## 6. Current recommendation

Hold further runtime extraction until browser smoke is available or until another test-first helper is prepared without touching `js/editor.js`.

The next implementation candidate should not touch:

- `editor-canvas.js`;
- `initCanvas()`;
- `createEditorCanvas(...)` wiring;
- `handleMemoriesUpdated` or `window.refreshMemories`;
- `createEditorMemoryActions(...)`;
- `createEditorMemoryForm(...)`;
- selected/current memory state;
- auth start gate;
- API/backend/schema;
- public viewer route.
