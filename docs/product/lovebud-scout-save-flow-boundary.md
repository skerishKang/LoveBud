# LoveBud Scout Save Flow Boundary Audit

## Baseline

- **main HEAD**: `f7b013d2` (fix(product): repair Scout draft toolbar wiring and validation #2205)
- **Related PRs**: #2203 (Scout Draft Manual MVP), #2205 (toolbar wiring + validation hotfix)
- **Related Issues**: #1882 (PRODUCT: Explore LoveBud Scout link-based fan assistant MVP), #1661 (DB/API: Add tree-level social counts for Browse sorting)
- **Current Tests**: 1850 pass (including 2 new Scout contract tests: `scout-draft-validation-contract.test.cjs`, `scout-toolbar-wiring-contract.test.cjs`)

---

## Current Scout Draft Flow

### Entrypoint
- **Trigger**: Editor floating toolbar "..." (more button) → dropdown → "Scout로 순간 저장" (scanner icon, data-action="scout")
- **Location**: `js/editor/templates/editor-floating-toolbar-template.js:37-39`
- **Wiring**: `editor-floating-toolbar.js` → `editor-floating-toolbar-dropdown.js` → `LoveBudScoutDraftUI.open(selectedNodeId)`

### Modal UI
- **Module**: `js/scout/scout-draft-ui.js` → `LoveBudScoutDraftUI.createScoutDraftUI(deps)`
- **Dependencies injected**: `treeId`, `getSelectedNodeId`, `getCanonicalRootId`, `resolveParentIdForCreate`, `showToast`, `i18n`, `onDraftSave`, `onDraftCancel`
- **Fields**: Source URL (required-ish), Excerpt/Summary, Memo, Emotion Tags (comma-separated, max 4, max 20 chars each)

### Draft Build
- **Module**: `js/scout/scout-draft.js` → `LoveBudScoutDraft.buildScoutDraft({ sourceUrl, excerpt, memo, emotionTags, treeId })`
- **Validation**: 
  - `sourceUrl`: HTTP/HTTPS only, optional
  - `excerpt`: optional
  - `memo`: optional  
  - `emotionTags`: array, max 4, each ≤ 20 chars
  - **Non-empty check**: At least one of `sourceUrl`/`excerpt`/`memo` must have content (added in #2205)

### Payload Conversion
- **Function**: `LoveBudScoutDraft.convertDraftToMemoryPayload(draft, resolveParentIdForCreate, getSelectedNodeId, getCanonicalRootId, i18n)`
- **Output fields**:
  ```js
  {
    treeId: draft.treeId,
    title: excerpt[0:50] || domain(sourceUrl) || '수동 저장 순간' || '새 순간',
    memo: excerpt + '\n\n' + memo,
    timestamp: draft.createdAt.split('T')[0].replace(/-/g, '.'),  // YYYY.MM.DD
    sourceUrl: draft.sourceUrl,           // original user URL (not embed URL)
    sourceType: 'scout',
    emotionTags: draft.emotionTags || [],
    parentId: resolveParentIdForCreate(getSelectedNodeId(), getCanonicalRootId()),
    thumbnail: '',
    artist: '',
    source: 'Scout',
    visibility: 'public'
  }
  ```

### Callback / Save Behavior
- **onDraftSave** is injected into `createScoutDraftUI(deps)` but **no consumer currently provides it**
- **Current behavior**: In `scout-draft-ui.js:206-211`:
  ```js
  if (onDraftSave) {
      onDraftSave(payloadResult.data, draftResult.data);
  } else {
      // Default: show success toast
      showToast?.(t('save_saved') || '저장됨', 'success');
  }
  ```
- **Result**: Payload is generated, toast says "저장됨" (Saved), but **no actual persistence occurs**
- **Preview flow** (`scout-draft-ui.js:361`) also calls `onDraftSave` with same payload

---

## Existing Memory Save Flow

### Add Memory Entrypoints
1. **Sidebar "새 순간 이어가기" button** (`addMemoryBtn`) → opens `addMemoryForm` modal
2. **Canvas empty guide "YouTube 링크 붙여넣기"** → auto-fills form → submits
3. **Floating toolbar "이어가기" button** (`ftbContinueBtn`) → delegates to `continueFromMomentBtn` or `addMemoryBtn`
4. **URL drop** on `memoryUrlInput` → auto-submits

### Payload Builder
- **Module**: `js/editor/editor-memory-form-payload.js` → `LoveBudEditorMemoryFormPayload.buildMemoryPayload(options)`
- **Key fields in output** (`editor-memory-form-payload.js:177-190`):
  ```js
  {
    treeId,
    title: resolvedTitle,           // user title or fallback from URL
    memo: memoValue || '',
    timestamp: todayDateString(),   // YYYY.MM.DD (same format)
    sourceUrl: mediaSource.embedUrl, // YouTube embed URL (not original!)
    sourceType: mediaSource.sourceType, // 'youtube' | 'other'
    emotionTags: [],                // always empty array in current flow
    parentId: resolveParentIdForCreate(getSelectedNodeId(), freshCanonicalRootId),
    thumbnail: mediaSource.thumbnailUrl, // YouTube thumbnail or ''
    artist: '',
    source: mediaSource.sourceLabel,  // 'YouTube' | ''
    visibility: 'public'
  }
  ```

### Parent/Selection Behavior
- **Parent resolution**: `editor-tree-helpers.js:94-102` → `resolveParentIdForCreate(selectedNodeId, canonicalRootId)`
  - If `selectedNodeId` exists → parent = selected node's ID (continues branch)
  - Else → parent = canonical root ID (new root-level memory)
- **Selected node**: From canvas `.memory-node.selected` element

### Save Execution
- **Module**: `js/editor/editor-memory-form.js:430-462` → `addMemoryFromForm()`
- **API call**: `window.apiClient.createMemory(enrichedPayload)` if available
- **Local fallback**: Creates memory object with `nextMemoryId()` and adds to tree
- **Commit**: `commitMemoryToTree()` → normalizes → adds to tree data → refreshes canvas/detail/sidebar

### Refresh Behavior
- Canvas re-renders with new node
- Detail panel updates if node selected
- Sidebar tree updates

---

## Payload Compatibility Matrix

| Field | Scout Payload | Existing Memory Flow | Compatible? | Notes |
|-------|---------------|---------------------|-------------|-------|
| `treeId` | `draft.treeId` | `treeId` | ✅ | Same |
| `title` | excerpt[0:50] or domain or fallback | user title or URL fallback | ⚠️ | Scout uses excerpt first; existing uses explicit title input |
| `memo` | excerpt + '\n\n' + memo | `memoValue` only | ⚠️ | Scout combines excerpt+memo; existing only has memo |
| `timestamp` | `YYYY.MM.DD` (from draft createdAt) | `YYYY.MM.DD` (today) | ✅ | Same format |
| `sourceUrl` | **Original user URL** | **YouTube embed URL** | ❌ | **Major difference**: Scout stores original; existing stores embed |
| `sourceType` | `'scout'` | `'youtube'` or `'other'` | ⚠️ | Different enum values |
| `emotionTags` | User tags (max 4) | `[]` (always empty) | ❌ | Existing doesn't support tags yet |
| `parentId` | `resolveParentIdForCreate(getSelectedNodeId(), ...)` | Same function | ✅ | Same logic |
| `thumbnail` | `''` | YouTube thumbnail or `''` | ✅ | Both empty for non-YouTube |
| `artist` | `''` | `''` | ✅ | Same |
| `source` | `'Scout'` | `'YouTube'` or `''` | ⚠️ | Different source identifiers |
| `visibility` | `'public'` | `'public'` | ✅ | Same default |
| `channelId/Name/Url` | Not present | Present for YouTube | ⚠️ | Scout doesn't extract channel info |

---

## Identified Gaps

### 1. **No Actual Persistence** (Critical)
- `onDraftSave` callback is **not wired** anywhere
- Toast shows "저장됨" but nothing is saved to API or local tree
- **Location**: `editor.html` includes Scout modules but no `onDraftSave` consumer

### 2. **sourceUrl Semantic Mismatch** (High)
- Scout: Stores **original user-provided URL** (e.g., `https://example.com/article`)
- Existing: Stores **YouTube embed URL** (e.g., `https://www.youtube.com/embed/abc123`)
- If Scout payload goes through existing `createMemory`, the original URL is lost

### 3. **emotionTags Not Supported in Existing Model** (High)
- Existing `emotionTags: []` is hardcoded empty
- Database/API schema may not have this field
- Need to verify API `createMemory` accepts `emotionTags`

### 4. **sourceType Enum Mismatch** (Medium)
- Scout: `'scout'` (new value)
- Existing: `'youtube'` | `'other'`
- API validation may reject unknown `sourceType`

### 5. **source Field Mismatch** (Medium)
- Scout: `'Scout'`
- Existing: `'YouTube'` or `''`
- Display logic may depend on `source` value

### 6. **Missing Channel Info** (Low)
- Existing extracts YouTube channel metadata (channelId, channelName, channelUrl)
- Scout has no equivalent (by design - no fetch)

### 7. **Title Generation Difference** (Low)
- Scout: Uses excerpt first 50 chars → domain → fallbacks
- Existing: Uses explicit title input → URL fallback
- Could result in different titles for same content

### 8. **Read-Only Tree / Visibility Guard** (Medium)
- No check if current tree is read-only before showing Scout action
- Scout action visible in dropdown regardless of tree permissions

### 9. **Selected Node Context** (Medium)
- Scout action uses currently selected node for `parentId`
- If no node selected → `parentId = canonicalRootId` (correct)
- But UX: Should Scout action be disabled/hidden when no tree loaded?

---

## Safety Boundary

| Check | Status | Notes |
|-------|--------|-------|
| No AI provider integration | ✅ | No AI imports, no provider calls |
| No external URL fetching | ✅ | Only URL validation via `new URL()` |
| No metadata extraction | ✅ | No OpenGraph, no YouTube API |
| No backend/schema migration | ✅ | No DB changes |
| No copyrighted full-text automation | ✅ | User manually enters excerpt/memo |
| No innerHTML XSS exception | ✅ | `scout-draft-ui.js` uses `createElement` + `textContent` |
| URL protocol restricted to HTTP/HTTPS | ✅ | `validateSourceUrl` rejects others |
| Target=_blank with rel=noopener | ✅ | Preview link uses `rel="noopener"` |

---

## Recommended Next Slice

### Option A: Wire into Existing Add-Memory Form (Recommended)
**Scope**: Reuse `editor-memory-form.js` + `editor-memory-form-payload.js` as the save path

**Steps**:
1. In `editor.html` or startup, create `LoveBudScoutDraftUI` with `onDraftSave` that delegates to existing `addMemoryFromForm`:
   - Map Scout payload → existing form fields (urlInput, titleInput, memoInput)
   - Programmatically fill form → call `addMemoryFromForm()`
2. Or: Add a `createMemoryFromScoutPayload(payload)` function in `editor-memory-form.js` that bypasses form UI

**Pros**: Reuses all existing validation, API call, refresh logic
**Cons**: Field mapping complexity (sourceUrl mismatch, emotionTags)

### Option B: Direct API Call from Scout
**Scope**: Add `createScoutMemory` function that calls `apiClient.createMemory` directly

**Steps**:
1. Create new module or extend `editor-memory-actions.js` with `createScoutMemory(payload)`
2. Wire `onDraftSave` to call it
3. Handle refresh manually

**Pros**: Clean separation, no form mapping
**Cons**: Duplicates save logic, need to replicate commit/refresh

### Option C: Extend Existing Payload Builder
**Scope**: Add `buildScoutMemoryPayload` to `editor-memory-form-payload.js`

**Steps**:
1. Accept Scout draft directly
2. Handle `sourceUrl` as `sourceUrl` (original) + add `scoutSourceUrl` or similar
3. Add `emotionTags` to payload
4. Reuse existing `addMemoryFromForm` path

**Pros**: Single source of truth for payload shape
**Cons**: Requires API schema support for new fields

---

## Recommended Minimum Implementation

```text
[PRODUCT] Wire Scout draft payload into existing add-memory form flow

1. Add onDraftSave consumer in editor-shell-startup.js or editor-shell-memory.js
2. Map Scout payload → editor-memory-form fields (urlInput=sourceUrl, titleInput=title, memoInput=memo)
3. Call existing addMemoryFromForm() to reuse API + refresh
4. Verify emotionTags persistence (may need API schema update)
5. Update sourceType handling for 'scout' value
```

**Non-goals for next slice**:
- No AI provider
- No external fetch
- No backend/schema migration unless existing payload cannot support Scout fields
- No full-text extraction

---

## Test-Only Candidates (if docs-only PR)

- ✅ Scout payload field names documented against existing memory payload
- ✅ Scout module contains no fetch/AI provider references
- ✅ Scout preview has no innerHTML exception (uses createElement)
- ✅ `onDraftSave` callback type documented (currently `Function | undefined`)

---

## Document Metadata

- **Created**: 2026-06-05
- **Author**: Audit follow-up for #1882
- **Status**: Draft → needs PR review
- **Next Review**: After #2205 merge confirmation