# Editor Memory Form Decomposition Readiness Audit

## Audit Scope

- **Issue**: #3100
- **Parent**: #3086, #1882
- **Protected**: #2960 (detail panel), #2856 (growth affordance), #3070 (save completion — paused)
- **Explicit exclusions**: existing `editor-memory-form-*.js` sub-modules (mode, preview, time, payload — already separated), #3070 save completion scope, #2960/#2856 protected scopes
- **Runtime (this audit PR)**: No changes
- **Documentation only (this audit PR)**

## 1. Base SHA

- **Current main**: `b5f3a90dfb075ff6562e3a69137dbc365e0493e0`
- **No open PRs interfering**: only #2960 (protected), #2856 (protected) are open
- **No pending changes** on `main`

## 2. Current `js/editor/editor-memory-form.js` Responsibility Cluster Map

Total: 571 lines. Factory function `createEditorMemoryForm(deps)` that returns an object with 6 methods. No IIFE. Exported as `window.createEditorMemoryForm` (line 571).

### 2.1 Dependency injection (lines 1–28)

Accepts 25 dependencies as a single `deps` object:
```
i18n, treeId, getSelectedNodeId, getCanonicalRootId, resolveParentIdForCreate,
updateSaveStatus, showToast, getYouTubeInputErrorMessage, nextMemoryId,
normalizeMemory, getTreeMemories, setTreeMemories, setLocalSaveMode,
drawNode, drawBranch, calcPosition, updateSidebarStatus,
updateFocusSelectedBtn, setDetailEmptyState, selectNode, treeMemories,
setCachedMemories, rerenderCanvas, focusNodeById, canEdit
```

4 sub-module references (lines 30–33):
- `LoveBudEditorMemoryFormMode` — `modeHelper`
- `LoveBudEditorMemoryFormPreview` — `previewHelper`
- `LoveBudEditorMemoryFormTime` — `timeHelper`
- `LoveBudEditorMemoryFormPayload` — `payloadHelper`

### 2.2 Internal state (lines 35–58)

- `isFormOpen` (boolean, line 44)
- `escHandler`, `outsideClickHandler`, `previewInputHandler`, `startTimeInputHandler`, `endTimeInputHandler` (event handlers to clean up, lines 45–49)
- `userHasEditedStartTime`, `userHasEditedTitle` (booleans, lines 50–51)
- `currentInputMode` (`'link'` | `'text'`, line 52)
- `_addMemoryInvoker` (DOM node reference, line 53)
- `isEditorDebugEnabled()`, `editorDebugLog()` (lines 35–42)
- `getFreshCanonicalRootId()` (lines 55–59)

### 2.3 DOM refs (lines 61–94)

24 DOM elements via `document.getElementById` / `querySelector`:
```
addMemoryForm, urlInput, titleInput, memoInput, urlField,
modeLinkBtn, modeTextBtn, supportNoteText, startTimeField,
videoSegmentGrid, startTimeInput, startTimeHint, endTimeInput,
canvasEmptyGuide, canvasTopbar, formEyebrow, formTitle, formIntro,
urlLabel, titleLabel, tagsInput, tagsLabel, memoLabel,
confirmBtn, preview, thumb, thumbWrap, playIcon, previewBody,
badge, previewTitle, previewHint
```

### 2.4 Form lifecycle — open (lines 289–343)

`showAddMemoryForm()`:
- Captures current focus (invoker) if form closed (lines 295–305)
- `resetFormValues()` (line 307)
- `applyFormOpenStyles()` — sets `display:block`, adds `.is-open` (lines 111–116)
- `setEmptyGuideSuppressed(true)` — hides empty guide canvas, sets `aria-hidden` (lines 118–149)
- Determines `isFirstMoment` from memories length (lines 312–313)
- `applyOpenCopy(isFirstMoment)` — sets i18n copy for eyebrow, title, labels (lines 234–248)
- `setInputMode('link', isFirstMoment)` via `modeHelper` (lines 316–319)
- Binds focus trap, Escape, outside-click, and preview events (lines 321–342)

### 2.5 Form lifecycle — close (lines 345–371)

`hideAddMemoryForm(options)`:
- Hides form, removes `.is-open`
- `setEmptyGuideSuppressed(false)` with aria-hidden restoration
- Removes all event listeners (focusTrap, esc, outsideClick, preview input, startTime input, endTime input)
- `restoreFocusToInvoker()` — returns focus to the element that opened the form via `requestAnimationFrame` with 6 safety checks (lines 202–220)

### 2.6 Event binding (lines 250–287)

`bindPreviewEvents(isFirstMoment)`:
- URL input → `timeHelper.autofillStartFromUrl()` + `updatePreview()`
- Start time input → marks `userHasEditedStartTime = true` + `updatePreview()`
- End time input → `updatePreview()`
- Title input → marks `userHasEditedTitle = true` (once)
- Input mode buttons (`modeLinkBtn`, `modeTextBtn`) bound in showAddMemoryForm (lines 318–319)

### 2.7 Save orchestration — API + local fallback (lines 373–408)

`createMemoryWithFallback(newMemoryData)`:
- Tries `window.apiClient.createMemory(newMemoryData)` (line 377)
- On success: `setLocalSaveMode(false)`
- On 401/403: toast warning
- On 400: save status `'failed'` + error toast
- Other: toast info about local fallback
- Fallback: `setLocalSaveMode(true)`, creates local object via `nextMemoryId()` (lines 400–406)
- Returns `{ createdMemory, useApi }`

### 2.8 Save orchestration — tree commit (lines 410–457)

`commitMemoryToTree(createdMemory, useApi)`:
- `normalizeMemory(createdMemory)` (line 411)
- Pushes to tree memories array — `setTreeMemories(nextMemories)` (lines 412–415)
- Canvas update via `rerenderCanvas()` or individual `drawNode()` + `drawBranch()` (lines 424–431)
- Node selection + `new-node-highlight` CSS class for 2s (lines 433–442)
- `focusNodeById(normalizedMemory.id)` (lines 443–445)
- `updateSaveStatus('saved', ...)` — distinguishes API vs local (line 447)
- `setCachedMemories(treeId, ...)` — refreshes localStorage cache (lines 449–452)
- `updateSidebarStatus()`, `updateFocusSelectedBtn()`, `setDetailEmptyState(false)` (lines 454–456)

### 2.9 Save orchestration — submit (lines 483–517)

`addMemoryFromForm()`:
- Calls `payloadHelper.buildMemoryPayload({...})` with 10+ dependency references (lines 491–503)
- On validation failure: showToast with error + return (lines 505–508)
- `updateSaveStatus('saving', ...)` (line 510)
- `hideAddMemoryForm({ restoreFocus: false })` (line 511)
- `enrichPayloadChannelMetadata(payloadResult.data, rawUrl)` (line 513)
- `createMemoryWithFallback(enrichedPayload)` (line 514)
- `commitMemoryToTree(createdMemory, useApi)` (line 515)
- `restoreFocusToInvoker()` (line 516)

### 2.10 Scout integration (lines 519–559)

`addMemoryFromScoutPayload(payload, draft)`:
- Switches input mode to `'text'` (line 523)
- Resets form values (line 526)
- Populates title from payload/draft (lines 530–534)
- Builds memo with attribution + source + emotion tags + Scout label (lines 536–545)
- Opens form UI (lines 548–555)
- Delegates to `addMemoryFromForm()` for actual save (line 558)

### 2.11 Channel metadata enrichment (lines 459–481)

`shouldEnrichChannelMetadata(payload, rawUrl)` (lines 459–464):
- Only YouTube payloads, only payloads missing channel info, only if `apiClient.getYouTubeOEmbedChannel` exists

`enrichPayloadChannelMetadata(payload, rawUrl)` (lines 466–481):
- Calls `apiClient.getYouTubeOEmbedChannel(rawUrl)` (line 469)
- Merges `channelId`, `channelName`, `channelUrl` if response is valid (lines 472–475)
- Non-fatal on failure (line 477–480)

### 2.12 Focus trap (lines 184–200)

- Tab/Shift+Tab cycling through form inputs
- Guarded by `isFormOpen` (line 185)

### 2.13 Utility functions

- `getFormInputs()` (lines 96–105) — returns array of form input elements
- `setText(el, text)` (lines 107–109) — safe textContent setter
- `resetFormValues()` (lines 222–232) — clears all inputs + start/edit tracking flags
- `setEmptyGuideSuppressed(isSuppressed)` (lines 118–149) — controls empty guide + canvas topbar `aria-hidden`

### 2.14 Exports (lines 561–571)

```js
return {
    showAddMemoryForm,
    hideAddMemoryForm,
    addMemoryFromForm,
    addMemoryFromScoutPayload,
    isFormOpen: () => isFormOpen,
    enrichPayloadChannelMetadata
};
window.createEditorMemoryForm = createEditorMemoryForm;
```

### Cluster size summary

| Cluster | Lines | % of file |
|---------|------:|----------:|
| Depex + refs + state | 93 | 16% |
| Form lifecycle (open/close) | 87 | 15% |
| Save orchestration (submit + API + commit) | 145 | 25% |
| Event binding | 38 | 7% |
| Scout integration | 41 | 7% |
| Channel enrichment | 23 | 4% |
| Focus trap + utility | 48 | 8% |
| Exports | 12 | 2% |
| Whitespace/comments | ~84 | 15% |

## 3. Already-Extracted Sub-Modules

| Module | File | Lines | Export |
|--------|------|------:|--------|
| Mode | `editor-memory-form-mode.js` | 140 | `LoveBudEditorMemoryFormMode.setInputMode` |
| Preview | `editor-memory-form-preview.js` | 266 | `LoveBudEditorMemoryFormPreview` (9 methods) |
| Time | `editor-memory-form-time.js` | 72 | `LoveBudEditorMemoryFormTime` (6 methods) |
| Payload | `editor-memory-form-payload.js` | 231 | `LoveBudEditorMemoryFormPayload` (4 methods) |

**Total extracted**: 709 lines across 4 modules.
**Remaining in orchestrator**: 571 lines.

## 4. Script Order and Dependencies

### Script load order (`pages/editor.html` lines 184–188)

```
184: editor-memory-form-mode.js    → LoveBudEditorMemoryFormMode
185: editor-memory-form-preview.js  → LoveBudEditorMemoryFormPreview
186: editor-memory-form-time.js     → LoveBudEditorMemoryFormTime
187: editor-memory-form-payload.js  → LoveBudEditorMemoryFormPayload
188: editor-memory-form.js          → window.createEditorMemoryForm
```

Called in `editor.js` at line 589:
```js
const memoryForm = window.createEditorMemoryForm({ ...25 deps... });
```

The 4 sub-modules load **before** `editor-memory-form.js` and **before** `editor.js` which calls the factory.

### Global dependencies consumed

| Global | Role | Owner File |
|--------|------|-----------|
| `LoveBudEditorMemoryFormMode` | Input mode switching | `editor-memory-form-mode.js` |
| `LoveBudEditorMemoryFormPreview` | Link preview rendering | `editor-memory-form-preview.js` |
| `LoveBudEditorMemoryFormTime` | YouTube time parsing | `editor-memory-form-time.js` |
| `LoveBudEditorMemoryFormPayload` | Memory payload building | `editor-memory-form-payload.js` |
| `LoveBudMedia` | YouTube ID/URL/channel extraction | Shared media module |
| `LoveBudEditorUtils` | `getCanonicalRootId` | Editor utils |
| `LoveBudEditorCanvasSelection` | `findMemoryNodeById` | Canvas selection module |
| `apiClient` | `createMemory`, `getYouTubeOEmbedChannel` | API client |
| `setCachedMemories` | Cache persistence | Editor cache module |

### Global surface

- `window.createEditorMemoryForm` — only export (line 571)
- `window.LoveBudDebug`, `window.LOVEBUD_EDITOR_DEBUG` — debug flags (read, line 36)
- `window.LoveBudTreeWorkspaceClassifier` — localization key detection (read by payload helper, line 109)

## 5. #3070 Save Completion Boundary

**#3070 (`[UX][Editor] Confirm moment-save completion without losing editing context`)** owns:
- Existing moment edit-save feedback (edit existing → save button → confirmation)
- Dirty state tracking for edited fields
- Preventing duplicate writes on edited moments

**This file (`editor-memory-form.js`)** owns:
- New moment creation form lifecycle
- First or subsequent moment added to tree
- API create flow + local fallback

**Overlap analysis**:
- `createMemoryWithFallback` and `commitMemoryToTree` are NEW-moment paths, not edit paths
- `updateSaveStatus` is called within `commitMemoryToTree` but uses the same `'saved'` / `'failed'` / `'saving'` status values
- The save-status rendering surface is shared by both new-moment and edit flows
- **Safe boundary**: extraction of new-moment save orchestration does not touch edit-moment save semantics. The `updateSaveStatus` value contract must remain compatible.

## 6. First Extraction Candidate

### Candidate: Save orchestration cluster → dedicated `editor-memory-form-save.js`

**Functions to extract**:
- `createMemoryWithFallback(newMemoryData)` (lines 373–408)
- `commitMemoryToTree(createdMemory, useApi)` (lines 410–457)
- `addMemoryFromForm()` (lines 483–517)
- `shouldEnrichChannelMetadata(payload, rawUrl)` (lines 459–464)
- `enrichPayloadChannelMetadata(payload, rawUrl)` (lines 466–481)
- `addMemoryFromScoutPayload(payload, draft)` (lines 519–559)
- `getFreshCanonicalRootId()` (lines 55–59)

**Total extracted size**: ~145 lines (25% of file)
**Remaining in orchestrator**: ~400 lines

**Rationale**: These functions form the **save pipeline** — validation via payload helper → API call → tree commit → canvas update. They are called from the form lifecycle (after user presses submit) and are orthogonal to form open/close, event binding, and focus management. The cluster has only 5 external deps: `payloadHelper` (already extracted), `apiClient`, `normalizeMemory`, `updateSaveStatus`, canvas rendering functions.

**Key invariants**:
- `createMemoryWithFallback` must still call `window.apiClient.createMemory` with the same payload shape, same error classification (401/403/400/other), and same local fallback behavior
- `commitMemoryToTree` must produce identical memory array mutations, same canvas update sequence, same CSS highlight, same cache refresh, same save-status call
- `addMemoryFromForm` must call `hideAddMemoryForm({ restoreFocus: false })` at the same point, then `restoreFocusToInvoker()` after save completes
- `addMemoryFromScoutPayload` must open the form UI identically before delegating to `addMemoryFromForm()`
- All `updateSaveStatus` calls must preserve status values (`'saving'`, `'saved'`, `'failed'`) and i18n message keys

**Allowed files** (minimum set):
- `js/editor/editor-memory-form-save.js` (new)
- `js/editor/editor-memory-form.js` (remove extracted functions, delegate via `LoveBudEditorMemoryFormSave`)
- `pages/editor.html` (add `<script>` tag before `editor-memory-form.js`)

**Forbidden files**:
- Existing `editor-memory-form-*.js` sub-modules (mode, preview, time, payload)
- `js/editor.js` (caller — unchanged, only import path changes)
- `js/viewer/*`, `css/*`, `functions/*` (no deployment changes)
- Protected PR scope files

**Preserved globals**:
- `window.createEditorMemoryForm` — unchanged (factory remains in orchestrator)
- New module exports `window.LoveBudEditorMemoryFormSave` with methods

**Rollback condition**:
- If `addMemoryFromForm` submit sequence changes (hide timing, focus restore timing) → revert
- If `createMemoryWithFallback` error classification or fallback behavior changes → revert
- If `commitMemoryToTree` canvas update sequence or save-status contract changes → revert
- If `editor.html` script order breaks (new module not loaded before `editor-memory-form.js`) → revert
- If save-status values or i18n message keys change → revert

## 7. Future Extraction Candidates (After First Slice)

### Candidate 2: Form lifecycle cluster → `editor-memory-form-lifecycle.js`

- `showAddMemoryForm()` (lines 289–343)
- `hideAddMemoryForm()` (lines 345–371)
- `showAddMemoryForm` internal helpers: `applyFormOpenStyles`, `setEmptyGuideSuppressed`, `applyOpenCopy`
- `hideAddMemoryForm` internal helpers: `setEmptyGuideSuppressed(false)`, `restoreFocusToInvoker`
- `restoreFocusToInvoker()` (lines 202–220)
- Focus trap (lines 184–200)
- `resetFormValues()` (lines 222–232)

**Estimated size**: ~120 lines
**Dependency on #3070**: None — form lifecycle is independent of save orchestration.

### Candidate 3: Event binding cluster → `editor-memory-form-events.js`

- `bindPreviewEvents(isFirstMoment)` (lines 250–287)
- Input mode button bindings (currently in `showAddMemoryForm` lines 318–319)

**Estimated size**: ~40 lines
**Note**: Depends on preview and time helpers. Minimal gain but isolates event cleanup discipline.

## 8. Future Focused Verification Matrix

| Scenario | Verification method |
|----------|-------------------|
| Open form (empty tree, first moment) | Focused contract test |
| Open form (populated tree, next moment) | Focused contract test |
| Close form via Escape | Focused contract test |
| Close form via outside click | Focused contract test |
| Close form via close button (if any) | Focused contract test |
| Focus restoration after close | Focused contract test (invoker receives focus) |
| Tab focus trap within form | Focused contract test |
| Input mode: link (YouTube URL valid) | Focused contract test |
| Input mode: link (YouTube channel URL) | Focused contract test |
| Input mode: text (no URL) | Focused contract test |
| Preview update on URL change | Focused contract test |
| Start time autofill from URL | Focused contract test |
| End time validation (> start time) | Focused contract test |
| Submit with valid link payload → API save | Focused contract test (stub apiClient) |
| Submit with valid text payload → API save | Focused contract test |
| Submit → API failure → local fallback save | Focused contract test |
| Submit → API 401/403 → toast + no fallback | Focused contract test |
| Submit → API 400 → validation toast | Focused contract test |
| Commit → canvas rerender + node highlight | Focused contract test |
| Commit → cache refresh | Focused contract test |
| Commit → save-status update | Focused contract test |
| Channel metadata enrichment | Focused contract test (YouTube oEmbed) |
| Scout payload → form population + submit | Focused contract test |
| Scout payload → text mode enforced | Focused contract test |
| Empty guide suppressed while form open | Focused contract test |
| Empty guide restored after form close | Focused contract test |
| Browser debug flag detection | Unit test |
| **Remote CI** | GitHub Actions (verify-static, Cloudflare Pages, GitGuardian) |
| **User production smoke** | One signed-in: create moment → verify canvas update |

### Prohibited
- Blanket `npm test`, `npm run verify:remote`, `npm run check:pr-guardrails`

## 9. No-Go Areas (Explicit)

- No #3070 save-completion UX changes (existing-moment edit feedback)
- No protected PR #2960 or #2856 scope changes
- No existing sub-module (mode, preview, time, payload) changes
- No runtime source, HTML, CSS, API, or deployment changes in this audit PR
- No fallback removal without equivalent tested boundary
- No `Closes #1882`, `Fixes #1882`, `Resolves #1882` — only `Refs #1882`

Refs #3100
Refs #3086
Refs #1882
