# Editor Helper Fallback Audit for #1698

**Status:** Active audit — refreshed after helper-boundary cleanup through PR #1900
**Owner:** CTO / Engineering Lead
**Related issue:** #1698
**Reference main SHA:** `8ee12e1403e1d9d3a2cbb496ab9e6db0003975bf`
**Audited file:** `js/editor.js`

This audit reviews the remaining helper fallback boundaries in `js/editor.js` after the event-binding, startup-context, and helper-boundary slices landed.

---

## Completed helper-boundary slices through PR #1900

The following editor entrypoint local fallback bodies have been removed from `js/editor.js` and now resolve through `window.LoveBudEditorShellHelpers` required boundaries:

| Helper | PR | Current state |
| --- | --- | --- |
| `createSelectedMomentFocusHandler` | #1891 | Required shell helper |
| `createSidebarTreeActionsUpdater` | #1892 | Required shell helper |
| `createCurrentMomentDetailOpener` | #1894 | Required shell helper |
| `createMemoryActionsReadinessWrapper` | #1895 | Required shell helper |
| `exposeRefreshMemoriesBridge` | #1896 | Required shell helper |
| `exposeDetailPanelUpdater` | #1897 | Required shell helper |
| `exposeCanvasEmptyGuideUpdater` | #1898 | Required shell helper |
| `createSaveStatusOrchestrationFallback` | #1899 | Required shell helper, with primary orchestration priority preserved |
| `resolveSaveStatusTimeFormatter` | #1900 | Required shell helper, with formatter priority preserved |

---

## 1. Current fallback groups

`js/editor.js` still contains several local fallback paths. They are not all equivalent. Some are small inline safety fallbacks, while others protect page startup, auth, canvas readiness, save status, and legacy global compatibility.

| Group | Examples | Current judgment |
| --- | --- | --- |
| Root utility fallbacks | `findRootMemory`, `getRootId`, `getCanonicalRootId`, `isRootMemory`, YouTube input error fallback | Hold. Depends on `LoveBudEditorUtils` load order and shared root semantics. |
| Shell/core fallbacks | `getHttpStatus`, `getI18n`, `getEditorBasePath`, `buildEditorRedirectTarget`, redirect fallback | Hold. Mostly safe but still protects startup and login redirect behavior. |
| Text/media resolver fallbacks | `safeI18nText`, `resolveHintText`, `resolveTreeTitleText`, `resolveInfoText`, `escapeHtml`, `resolveMemoryThumbnail` | Hold. Some paths depend on `LoveBudSecurity` and resolver fallback bundles. |
| Shell state/readiness fallbacks | `markEditorReady`, `applyEditorEditabilityState`, `createEditorDebugReporter`, dependency waiter | Hold. Too close to startup diagnostics and page readiness. |
| Global bridge fallbacks | `exposeCanvasEmptyGuideUpdater`, `exposeDetailPanelUpdater`, `exposeRefreshMemoriesBridge` | Completed through #1896-#1898. Keep browser smoke recommended. |
| Interaction helper fallbacks | selected-moment focus, sidebar tree actions, current-moment detail opener | Completed through #1891, #1892, and #1894, with #1893 test-first coverage for detail opener. |
| Save status fallback | `createSaveStatusOrchestrationFallback`, `resolveSaveStatusTimeFormatter` | Completed through #1899-#1900. Primary save-status orchestration and formatter priority preserved. |
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
next memory id fallback
```

These areas connect to root selection, auth redirect, i18n/copy, page readiness, or memory creation behavior.

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

Do not remove additional runtime fallbacks in the next PR without either authenticated editor browser smoke or test-first contract coverage for the exact fallback group.

The next best options are:

1. Run authenticated Editor browser smoke for current `main`.
2. If browser smoke is unavailable, add test-first contracts for one remaining small fallback group before any runtime removal.
3. Keep root/auth/redirect/resolver/readiness/data-loader fallback changes separate.
4. Avoid mixing documentation refresh, runtime fallback removal, and canvas refactors in one PR.

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
