# Search Duplicate Renderer Source-of-Truth Comparison

- Parent tracker: #656
- Audit source: #834 / PR #886
- Preflight source: PR #889
- Prior PR-C1: PR #890
- Prior PR-C2: PR #891
- Base main SHA: 22d9766201c751f5bf7021b5e0702395db7c13cd

## Audit scope

Compare root js/search-card-renderer.js and js/search-preview-renderer.js against their folder counterparts js/search/search-card-renderer.js and js/search/search-preview-renderer.js. Determine which is the active source of truth.

## Current runtime loading map

### pages/search.html

Loads folder versions (lines 134, 139):
- ../js/search/search-card-renderer.js
- ../js/search/search-preview-renderer.js

Root files (js/search-card-renderer.js, js/search-preview-renderer.js) are NOT loaded by any HTML page.

### pages/tree.html

Loads folder version (line 113):
- ../js/search/search-preview-renderer.js

## Candidate comparison table

### Card renderer

| Attribute | Root | Folder |
|---|---|---|
| Path | js/search-card-renderer.js | js/search/search-card-renderer.js |
| Exists | YES | YES |
| Line count | 378 | 413 |
| Export | window.LoveBudSearchCardRenderer | window.LoveBudSearchCardRenderer |
| Public API keys | Same (13 methods) | Same (13 methods) |
| HTML direct references | NONE | pages/search.html line 134 |
| Test references | NONE | search-runtime-modules.test.js (indirect) |
| Loaded at runtime | NO | YES |

### Preview renderer

| Attribute | Root | Folder |
|---|---|---|
| Path | js/search-preview-renderer.js | js/search/search-preview-renderer.js |
| Exists | YES | YES |
| Line count | 623 | 562 |
| Export | window.LoveBudSearchPreviewRenderer | window.LoveBudSearchPreviewRenderer |
| HTML direct references | NONE | pages/search.html, pages/tree.html |
| Test references | detail-alias-consistency.test.js (text read only) | search-runtime-modules.test.js |
| Loaded at runtime | NO | YES |

## Implementation differences

### Card renderer

Root and folder card renderers export identical public API surfaces. The folder version is newer (413 lines vs 378) with version v20260503-618 vs root v20260428-1. The root file is effectively dead code: not loaded by any page.

### Preview renderer

Root and folder preview renderers have different internal architectures:
- Root: standalone implementation with inline helpers (623 lines)
- Folder: delegates through modular helpers (LoveBudSearchPreviewBuilders, LoveBudSearchPreviewMediaHelper, etc.)

Both export the same window.LoveBudSearchPreviewRenderer namespace. The test detail-alias-consistency.test.js reads the root file from disk (text-only, no execution).

## Classifications

| File | Classification | Rationale |
|---|---|---|
| js/search-card-renderer.js | DELETE_CANDIDATE_AFTER_CONTRACT | Not loaded at runtime; no test references; identical API to folder version |
| js/search/search-card-renderer.js | ACTIVE_SOURCE_OF_TRUTH | Currently loaded by pages/search.html |
| js/search-preview-renderer.js | KEEP_UNTIL_DETAIL_ALIAS_REPLACED | Not loaded at runtime but referenced by detail-alias-consistency.test.js |
| js/search/search-preview-renderer.js | ACTIVE_SOURCE_OF_TRUTH | Currently loaded by pages/search.html and pages/tree.html |

## Recommended implementation split

1. PR-C3a: Remove js/search-card-renderer.js. Requires browser verification.
   - Risk: LOW (not loaded at runtime)
   - Browser verification: Search page loads + Browse cards render + preview open

2. PR-C3b: Update detail-alias-consistency.test.js to read from js/search/search-preview-renderer.js, then remove js/search-preview-renderer.js.
   - Risk: LOW (text-read only test)
   - Browser verification: Search page loads + Browse cards render + preview open

## Non-action statement

This audit does NOT authorize:
- Deleting root renderer files (requires separate PR with browser verification)
- Moving duplicate renderer files
- Changing runtime loading behavior
- Broad Search architecture rewrite

## NOT_VERIFIED

- No browser verification performed
- No runtime behavior verification
