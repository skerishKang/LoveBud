# Editor Helper Fallback Audit for #1698

**Status:** Active audit  
**Owner:** CTO / Engineering Lead  
**Related issue:** #1698  
**Reference main SHA:** `fb52f42f66ec92d70286ffe07cb26de32a710cab`  
**Audited file:** `js/editor.js`

This audit reviews the remaining helper fallback boundaries in `js/editor.js` after the event-binding and startup-context slices landed.

---

## 1. Current fallback groups

`js/editor.js` still contains several local fallback paths. They are not all equivalent. Some are small inline safety fallbacks, while others protect page startup, auth, canvas readiness, save status, and legacy global compatibility.

| Group | Examples | Current judgment |
| --- | --- | --- |
| Root utility fallbacks | `findRootMemory`, `getRootId`, `getCanonicalRootId`, `isRootMemory`, YouTube input error fallback | Hold. Depends on `LoveBudEditorUtils` load order and shared root semantics. |
| Shell/core fallbacks | `getHttpStatus`, `getI18n`, `getEditorBasePath`, `buildEditorRedirectTarget`, redirect fallback | Hold. Mostly safe but still protects startup and login redirect behavior. |
| Text/media resolver fallbacks | `safeI18nText`, `resolveHintText`, `resolveTreeTitleText`, `resolveInfoText`, `escapeHtml`, `resolveMemoryThumbnail` | Hold. Some paths depend on `LoveBudSecurity` and resolver fallback bundles. |
| Shell state/readiness fallbacks | `markEditorReady`, `applyEditorEditabilityState`, `createEditorDebugReporter`, dependency waiter | Hold. Too close to startup diagnostics and page readiness. |
| Global bridge fallbacks | `exposeCanvasEmptyGuideUpdater`, `exposeDetailPanelUpdater`, `exposeRefreshMemoriesBridge` | Hold. These expose legacy globals used by canvas/detail/refresh flows. |
| Interaction helper fallbacks | selected-moment focus, sidebar tree actions, current-moment detail opener | Possible later, but only with contract-first coverage. |
| Save status fallback | `createSaveStatusOrchestrationFallback`, `resolveSaveStatusTimeFormatter` | Hold. Touches save UI state and fallback behavior. |
| Data-loader fallback | `createInlineNextMemoryIdFallback` | Hold. Used only when helper is missing, but still affects memory creation IDs. |

---

## 2. Why fallback removal should stay conservative

The editor entrypoint is still a classic browser script with global namespace dependencies. Fallbacks are not simply dead code; they are part of the page's compatibility story when helper scripts load late, fail to load, or are partially unavailable.

The highest-risk issue is that many fallback removals would change the failure mode from degraded behavior to hard startup failure. That is acceptable only when script-order and helper contract coverage prove the helper is mandatory and always loaded before `js/editor.js`.

---

## 3. Fallbacks that should not be removed yet

Do not remove these without browser smoke and explicit contract coverage:

```text
root helper fallbacks
redirect/login path fallbacks
safe text/media resolver fallbacks
markEditorReady fallback
applyEditorEditabilityState fallback
debug reporter fallback
startup dependency waiter fallback
canvas/detail/refresh bridge fallbacks
save status orchestration fallback
next memory id fallback
```

These areas connect to root selection, auth redirect, i18n/copy, page readiness, canvas bridge behavior, save status, or memory creation behavior.

---

## 4. Possible low-risk future candidate

The most plausible future candidate is not deletion, but test-first extraction/contracting of one of the small interaction helpers:

```text
createSelectedMomentFocusHandler
createSidebarTreeActionsUpdater
createCurrentMomentDetailOpener
```

Even here, the safer path is:

1. Add or verify helper contract coverage.
2. Confirm script order for the helper namespace.
3. Avoid wiring changes until the contract exists.
4. Avoid mixing with canvas, save, auth, or data-loader changes.

---

## 5. Current recommendation

Do not remove fallbacks in the next PR.

Next best options:

1. Run authenticated Editor browser smoke for current `main`.
2. If browser smoke is unavailable, create a test-first helper contract for a small non-persistence helper.
3. Keep runtime wiring changes separate from helper-contract PRs.

The next PR should not touch:

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
